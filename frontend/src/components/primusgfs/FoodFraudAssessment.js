import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldOff,
  Plus,
  X,
  Edit2,
  Trash2,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { primusGFSAPI } from '../../services/api';

// =============================================================================
// CONSTANTS
// =============================================================================

const RISK_LEVELS = ['low', 'medium', 'high'];

const RISK_BADGE = {
  low: 'bg-green-100 text-primary dark:bg-green-900/30 dark:text-green-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const FRAUD_TYPES = [
  { key: 'adulteration_risk', label: 'Adulteration', description: 'Addition of foreign substances to reduce product quality or cost.' },
  { key: 'substitution_risk', label: 'Substitution', description: 'Replacement of a genuine ingredient with an inferior or different one.' },
  { key: 'mislabeling_risk', label: 'Mislabeling', description: 'Incorrect labeling of origin, content, weight, or certifications.' },
  { key: 'dilution_risk', label: 'Dilution', description: 'Reducing product concentration or quality by mixing with a cheaper substance.' },
  { key: 'unauthorized_enhancement_risk', label: 'Unauthorized Enhancement', description: 'Illegal addition of substances to improve appearance or shelf-life.' },
  { key: 'counterfeit_risk', label: 'Counterfeit', description: 'Production or distribution of fake goods under a recognized brand.' },
  { key: 'stolen_goods_risk', label: 'Stolen Goods', description: 'Handling or selling stolen agricultural inputs or harvested product.' },
];

const EMPTY_FRAUD_ENTRY = { vulnerable: false, risk_level: 'low', mitigation: '' };

const DEFAULT_FORM = {
  assessment_year: new Date().getFullYear(),
  assessment_date: '',
  assessed_by: '',
  overall_risk_level: 'low',
  adulteration_risk: { ...EMPTY_FRAUD_ENTRY },
  substitution_risk: { ...EMPTY_FRAUD_ENTRY },
  mislabeling_risk: { ...EMPTY_FRAUD_ENTRY },
  dilution_risk: { ...EMPTY_FRAUD_ENTRY },
  unauthorized_enhancement_risk: { ...EMPTY_FRAUD_ENTRY },
  counterfeit_risk: { ...EMPTY_FRAUD_ENTRY },
  stolen_goods_risk: { ...EMPTY_FRAUD_ENTRY },
  mitigation_plan: '',
  review_date: '',
  notes: '',
};

// =============================================================================
// HELPERS
// =============================================================================

const formatDate = (str) => {
  if (!str) return '-';
  return new Date(str).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

/**
 * Derives the suggested overall risk level as the highest individual risk among
 * all fraud types that are marked vulnerable.
 */
const deriveHighestRisk = (form) => {
  const order = { high: 2, medium: 1, low: 0 };
  let highest = 'low';
  FRAUD_TYPES.forEach(({ key }) => {
    const entry = form[key];
    if (entry?.vulnerable && order[entry.risk_level] > order[highest]) {
      highest = entry.risk_level;
    }
  });
  return highest;
};

// =============================================================================
// RISK BADGE
// =============================================================================

const RiskBadge = ({ level }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${RISK_BADGE[level] || RISK_BADGE.low}`}>
    {capitalize(level)}
  </span>
);

// =============================================================================
// ASSESSMENT MODAL
// =============================================================================

const AssessmentModal = ({ assessment, onClose, onSave }) => {
  const [form, setForm] = useState(() => {
    if (!assessment) return { ...DEFAULT_FORM };
    return {
      assessment_year: assessment.assessment_year || new Date().getFullYear(),
      assessment_date: assessment.assessment_date || '',
      assessed_by: assessment.assessed_by || '',
      overall_risk_level: assessment.overall_risk_level || 'low',
      adulteration_risk: assessment.adulteration_risk || { ...EMPTY_FRAUD_ENTRY },
      substitution_risk: assessment.substitution_risk || { ...EMPTY_FRAUD_ENTRY },
      mislabeling_risk: assessment.mislabeling_risk || { ...EMPTY_FRAUD_ENTRY },
      dilution_risk: assessment.dilution_risk || { ...EMPTY_FRAUD_ENTRY },
      unauthorized_enhancement_risk: assessment.unauthorized_enhancement_risk || { ...EMPTY_FRAUD_ENTRY },
      counterfeit_risk: assessment.counterfeit_risk || { ...EMPTY_FRAUD_ENTRY },
      stolen_goods_risk: assessment.stolen_goods_risk || { ...EMPTY_FRAUD_ENTRY },
      mitigation_plan: assessment.mitigation_plan || '',
      review_date: assessment.review_date || '',
      notes: assessment.notes || '',
    };
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  // Tracks whether the user has manually overridden the auto-suggested overall risk
  const [overallRiskManual, setOverallRiskManual] = useState(!!assessment);

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const updateFraudEntry = (key, field, value) => {
    setForm((prev) => {
      const updated = { ...prev, [key]: { ...prev[key], [field]: value } };
      // Auto-update overall risk if not manually overridden
      if (!overallRiskManual) {
        updated.overall_risk_level = deriveHighestRisk(updated);
      }
      return updated;
    });
  };

  const handleOverallRiskChange = (value) => {
    setOverallRiskManual(true);
    set('overall_risk_level', value);
  };

  const handleAutoSuggest = () => {
    setOverallRiskManual(false);
    setForm((prev) => ({ ...prev, overall_risk_level: deriveHighestRisk(prev) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(form, assessment?.id);
      onClose();
    } catch (err) {
      setSaveError(err.response?.data?.detail || 'Failed to save assessment. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary text-sm';
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  const suggestedRisk = deriveHighestRisk(form);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">

        {/* Modal Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 z-10">
          <div className="flex items-center gap-2">
            <ShieldOff className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {assessment ? 'Edit Assessment' : 'New Food Fraud Vulnerability Assessment'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {saveError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg">
              {saveError}
            </div>
          )}

          {/* Basic Info */}
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 pb-1 border-b border-gray-200 dark:border-gray-700">
              Basic Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Assessment Year *</label>
                <input
                  type="number"
                  required
                  min={2000}
                  max={2099}
                  value={form.assessment_year}
                  onChange={(e) => set('assessment_year', parseInt(e.target.value) || new Date().getFullYear())}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Assessment Date *</label>
                <input
                  type="date"
                  required
                  value={form.assessment_date}
                  onChange={(e) => set('assessment_date', e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Assessed By *</label>
                <input
                  type="text"
                  required
                  value={form.assessed_by}
                  onChange={(e) => set('assessed_by', e.target.value)}
                  placeholder="Name or role"
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Fraud Vulnerability Types */}
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 pb-1 border-b border-gray-200 dark:border-gray-700">
              Fraud Vulnerability Types
            </h3>
            <div className="space-y-3">
              {FRAUD_TYPES.map(({ key, label, description }) => {
                const entry = form[key] || { ...EMPTY_FRAUD_ENTRY };
                return (
                  <div
                    key={key}
                    className={`rounded-lg border p-4 transition-colors ${
                      entry.vulnerable
                        ? 'border-yellow-300 dark:border-yellow-700 bg-yellow-50/50 dark:bg-yellow-900/10'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                    }`}
                  >
                    {/* Card Header Row */}
                    <div className="flex flex-wrap items-start gap-3">
                      {/* Vulnerable Checkbox */}
                      <label className="flex items-center gap-2 cursor-pointer min-w-0 flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={!!entry.vulnerable}
                          onChange={(e) => updateFraudEntry(key, 'vulnerable', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
                        />
                        <span className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                          {label}
                        </span>
                      </label>

                      {/* Risk Level — only active when vulnerable */}
                      <div className="flex items-center gap-2 ml-auto flex-shrink-0">
                        <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Risk Level:</label>
                        <select
                          value={entry.risk_level}
                          onChange={(e) => updateFraudEntry(key, 'risk_level', e.target.value)}
                          disabled={!entry.vulnerable}
                          className={`px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-colors ${
                            entry.vulnerable
                              ? 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                              : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          {RISK_LEVELS.map((lvl) => (
                            <option key={lvl} value={lvl}>{capitalize(lvl)}</option>
                          ))}
                        </select>
                        {entry.vulnerable && (
                          <RiskBadge level={entry.risk_level} />
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-2">{description}</p>

                    {/* Mitigation — only shown when vulnerable */}
                    {entry.vulnerable && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Mitigation Measure
                        </label>
                        <textarea
                          value={entry.mitigation}
                          onChange={(e) => updateFraudEntry(key, 'mitigation', e.target.value)}
                          rows={2}
                          placeholder="Describe specific mitigation steps for this vulnerability..."
                          className={inputCls}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Overall Risk Level */}
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 pb-1 border-b border-gray-200 dark:border-gray-700">
              Overall Risk Assessment
            </h3>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[160px]">
                <label className={labelCls}>Overall Risk Level *</label>
                <select
                  required
                  value={form.overall_risk_level}
                  onChange={(e) => handleOverallRiskChange(e.target.value)}
                  className={inputCls}
                >
                  {RISK_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>{capitalize(lvl)}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3 pb-2">
                <RiskBadge level={form.overall_risk_level} />
                {overallRiskManual && suggestedRisk !== form.overall_risk_level && (
                  <button
                    type="button"
                    onClick={handleAutoSuggest}
                    className="text-xs text-primary hover:text-primary-hover dark:text-green-400 dark:hover:text-green-300 underline transition-colors"
                  >
                    Use suggested: {capitalize(suggestedRisk)}
                  </button>
                )}
                {!overallRiskManual && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 italic">Auto-derived from vulnerabilities</span>
                )}
              </div>
            </div>
          </div>

          {/* Overall Mitigation Plan */}
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 pb-1 border-b border-gray-200 dark:border-gray-700">
              Mitigation &amp; Review
            </h3>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Overall Mitigation Plan</label>
                <textarea
                  value={form.mitigation_plan}
                  onChange={(e) => set('mitigation_plan', e.target.value)}
                  rows={3}
                  placeholder="Describe the overall strategy to address identified food fraud vulnerabilities..."
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Review Date</label>
                  <input
                    type="date"
                    value={form.review_date}
                    onChange={(e) => set('review_date', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => set('notes', e.target.value)}
                    rows={2}
                    placeholder="Additional notes..."
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
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
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving...' : assessment ? 'Update Assessment' : 'Create Assessment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =============================================================================
// ASSESSMENT DETAIL CARD
// =============================================================================

const AssessmentDetail = ({ assessment, onEdit, onDelete }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const vulnerableTypes = FRAUD_TYPES.filter(({ key }) => assessment[key]?.vulnerable);
  const safeTypes = FRAUD_TYPES.filter(({ key }) => !assessment[key]?.vulnerable);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(assessment.id);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="lg:col-span-3 space-y-4">
      {/* Detail Header */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {assessment.assessment_year} Food Fraud Assessment
              </h3>
              <RiskBadge level={assessment.overall_risk_level} />
            </div>
            <div className="mt-1 flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span>Assessed: {formatDate(assessment.assessment_date)}</span>
              <span>By: {assessment.assessed_by || '-'}</span>
              {assessment.review_date && <span>Review: {formatDate(assessment.review_date)}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(assessment)}
              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-1">
                <span className="text-xs text-red-700 dark:text-red-400">Delete?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-xs font-medium text-red-700 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Yes'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  No
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Vulnerable Types */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
          Identified Vulnerabilities ({vulnerableTypes.length})
        </h4>
        {vulnerableTypes.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-primary dark:text-green-400">
            <CheckCircle className="w-4 h-4" />
            No vulnerabilities identified for this assessment year.
          </div>
        ) : (
          <div className="space-y-3">
            {vulnerableTypes.map(({ key, label, description }) => {
              const entry = assessment[key];
              return (
                <div
                  key={key}
                  className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10 p-3"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{label}</span>
                    <RiskBadge level={entry.risk_level} />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{description}</p>
                  {entry.mitigation ? (
                    <div>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">Mitigation:</p>
                      <p className="text-sm text-gray-800 dark:text-gray-200">{entry.mitigation}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic">No mitigation specified.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Non-Vulnerable Types (summary) */}
      {safeTypes.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Not Vulnerable ({safeTypes.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {safeTypes.map(({ key, label }) => (
              <span
                key={key}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary-light dark:bg-green-900/20 text-primary dark:text-green-400 border border-green-200 dark:border-green-800"
              >
                <CheckCircle className="w-3 h-3" />
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Mitigation Plan */}
      {assessment.mitigation_plan && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Overall Mitigation Plan</h4>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{assessment.mitigation_plan}</p>
        </div>
      )}

      {/* Notes */}
      {assessment.notes && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Notes</h4>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{assessment.notes}</p>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function FoodFraudAssessment() {
  const [assessments, setAssessments] = useState([]);
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState(null);

  const currentYear = new Date().getFullYear();

  const fetchAssessments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await primusGFSAPI.getFoodFraudAssessments();
      const data = response.data.results || response.data || [];
      const sorted = [...data].sort((a, b) => b.assessment_year - a.assessment_year);
      setAssessments(sorted);
      // Auto-select the most recent if nothing is selected yet
      setSelectedAssessment((prev) => {
        if (prev) {
          // Refresh the selected record in case it was updated
          const refreshed = sorted.find((a) => a.id === prev.id);
          return refreshed || (sorted.length > 0 ? sorted[0] : null);
        }
        return sorted.length > 0 ? sorted[0] : null;
      });
    } catch (err) {
      console.error('Failed to fetch food fraud assessments:', err);
      setError('Failed to load assessments. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  const handleSave = async (formData, id) => {
    if (id) {
      await primusGFSAPI.updateFoodFraudAssessment(id, formData);
    } else {
      await primusGFSAPI.createFoodFraudAssessment(formData);
    }
    fetchAssessments();
  };

  const handleDelete = async (id) => {
    await primusGFSAPI.deleteFoodFraudAssessment(id);
    setSelectedAssessment((prev) => (prev?.id === id ? null : prev));
    fetchAssessments();
  };

  const handleEdit = (assessment) => {
    setEditingAssessment(assessment);
    setShowModal(true);
  };

  const handleNew = () => {
    setEditingAssessment(null);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingAssessment(null);
  };

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <ShieldOff className="w-6 h-6" />
          Food Fraud Vulnerability Assessments
        </h2>
        <button
          onClick={handleNew}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Assessment
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 dark:text-red-400 mb-3">{error}</p>
          <button
            onClick={fetchAssessments}
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
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && assessments.length === 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
          <ShieldOff className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="font-medium text-gray-900 dark:text-white">No food fraud assessments found</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create your first assessment to start tracking food fraud vulnerabilities.
          </p>
          <button
            onClick={handleNew}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Assessment
          </button>
        </div>
      )}

      {/* Content: Year List + Detail */}
      {!loading && !error && assessments.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Year Selector Sidebar */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-1 self-start">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase px-2 mb-2">
              Assessments by Year
            </p>
            {assessments.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelectedAssessment(a)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between gap-2 ${
                  selectedAssessment?.id === a.id
                    ? 'bg-primary-light dark:bg-green-900/20 text-primary dark:text-green-400 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/30'
                } ${a.assessment_year === currentYear ? 'ring-1 ring-green-300 dark:ring-green-700' : ''}`}
              >
                <span>{a.assessment_year}</span>
                <RiskBadge level={a.overall_risk_level} />
              </button>
            ))}
          </div>

          {/* Detail Panel */}
          {selectedAssessment ? (
            <AssessmentDetail
              assessment={selectedAssessment}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ) : (
            <div className="lg:col-span-3 flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
              <div>
                <ShieldOff className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Select an assessment year to view details.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <AssessmentModal
          assessment={editingAssessment}
          onClose={handleModalClose}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
