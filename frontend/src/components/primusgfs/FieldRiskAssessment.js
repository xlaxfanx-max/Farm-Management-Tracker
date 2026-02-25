import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Plus,
  X,
  Edit2,
  Trash2,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { primusGFSAPI, farmsAPI } from '../../services/api';

// =============================================================================
// CONSTANTS
// =============================================================================

const RISK_LEVELS = [
  { value: 'low',      label: 'Low',      badge: 'bg-green-100  text-primary  dark:bg-green-900/30  dark:text-green-400',  dot: 'bg-green-500'  },
  { value: 'medium',   label: 'Medium',   badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', dot: 'bg-yellow-500' },
  { value: 'high',     label: 'High',     badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', dot: 'bg-orange-500' },
  { value: 'critical', label: 'Critical', badge: 'bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-400',    dot: 'bg-red-600'    },
];

const RISK_RANK = { low: 0, medium: 1, high: 2, critical: 3 };

const RISK_CATEGORIES = [
  { key: 'water_risk',         label: 'Water Risk',         icon: '💧', description: 'Irrigation source, runoff, flooding, drainage' },
  { key: 'soil_risk',          label: 'Soil Risk',          icon: '🪨', description: 'Prior contamination, pH, pathogens, heavy metals' },
  { key: 'adjacent_land_risk', label: 'Adjacent Land Risk', icon: '🏭', description: 'Neighboring operations, spray drift, runoff' },
  { key: 'animal_risk',        label: 'Animal Risk',        icon: '🐄', description: 'Wildlife, livestock access, vector activity' },
  { key: 'chemical_risk',      label: 'Chemical Risk',      icon: '⚗️',  description: 'Pesticide residues, prior chemical storage' },
];

const CURRENT_YEAR = new Date().getFullYear();

const EMPTY_CATEGORY = { risk_level: 'low', notes: '' };

const buildEmptyForm = () => ({
  farm: '',
  season_year: CURRENT_YEAR,
  assessment_date: '',
  assessed_by: '',
  overall_risk_level: 'low',
  water_risk:         { ...EMPTY_CATEGORY },
  soil_risk:          { ...EMPTY_CATEGORY },
  adjacent_land_risk: { ...EMPTY_CATEGORY },
  animal_risk:        { ...EMPTY_CATEGORY },
  chemical_risk:      { ...EMPTY_CATEGORY },
  mitigation_plan: '',
  notes: '',
});

// =============================================================================
// HELPERS
// =============================================================================

const formatDate = (str) => {
  if (!str) return '-';
  return new Date(str + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const getRiskConfig = (level) =>
  RISK_LEVELS.find((r) => r.value === level) || RISK_LEVELS[0];

const suggestOverallRisk = (form) => {
  const levels = RISK_CATEGORIES.map((c) => form[c.key]?.risk_level || 'low');
  const max = levels.reduce((best, cur) =>
    (RISK_RANK[cur] ?? 0) > (RISK_RANK[best] ?? 0) ? cur : best,
    'low'
  );
  return max;
};

// =============================================================================
// RISK BADGE
// =============================================================================

const RiskBadge = ({ level, size = 'sm' }) => {
  const config = getRiskConfig(level);
  const px = size === 'xs' ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full ${px} ${config.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
};

// =============================================================================
// RISK CATEGORY CARD (used in modal)
// =============================================================================

const RiskCategoryCard = ({ category, value, onChange }) => {
  // eslint-disable-next-line no-unused-vars
  const config = getRiskConfig(value.risk_level);
  return (
    <div className={`border rounded-xl p-4 space-y-3 transition ${
      value.risk_level === 'critical'
        ? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10'
        : value.risk_level === 'high'
        ? 'border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-900/10'
        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">{category.icon}</span>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{category.label}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{category.description}</p>
          </div>
        </div>
        <RiskBadge level={value.risk_level} size="xs" />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Risk Level</label>
        <div className="flex gap-2 flex-wrap">
          {RISK_LEVELS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => onChange({ ...value, risk_level: r.value })}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                value.risk_level === r.value
                  ? `${r.badge} border-current`
                  : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
        <textarea
          value={value.notes}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          rows={2}
          className="w-full px-2.5 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder={`Describe ${category.label.toLowerCase()} factors and observations...`}
        />
      </div>
    </div>
  );
};

// =============================================================================
// ASSESSMENT ROW (table)
// =============================================================================

const AssessmentRow = ({ assessment, farms, onEdit, onDelete, deleteConfirmId, setDeleteConfirmId }) => {
  const farm = farms.find((f) => f.id === assessment.farm) || {};
  const farmName = farm.name || `Farm #${assessment.farm}`;
  const isConfirming = deleteConfirmId === assessment.id;

  return (
    <tr className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
      <td className="px-4 py-3">
        <p className="font-medium text-sm text-gray-900 dark:text-white">{farmName}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">by {assessment.assessed_by || '-'}</p>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
        {assessment.season_year}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
        {formatDate(assessment.assessment_date)}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {RISK_CATEGORIES.map((cat) => {
            const level = assessment[cat.key]?.risk_level;
            if (!level || level === 'low') return null;
            return (
              <span
                key={cat.key}
                title={`${cat.label}: ${level}`}
                className={`px-1.5 py-0.5 rounded text-xs ${getRiskConfig(level).badge}`}
              >
                {cat.label.split(' ')[0]}
              </span>
            );
          })}
        </div>
      </td>
      <td className="px-4 py-3">
        <RiskBadge level={assessment.overall_risk_level} />
      </td>
      <td className="px-4 py-3 text-right">
        {isConfirming ? (
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs text-red-600 dark:text-red-400">Delete?</span>
            <button
              onClick={() => onDelete(assessment.id)}
              className="px-2.5 py-1 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
            >
              Confirm
            </button>
            <button
              onClick={() => setDeleteConfirmId(null)}
              className="px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => onEdit(assessment)}
              className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
              title="Edit"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDeleteConfirmId(assessment.id)}
              className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
};

// =============================================================================
// MODAL
// =============================================================================

const AssessmentModal = ({ editingRecord, farms, onClose, onSaved }) => {
  const isEdit = Boolean(editingRecord);
  const [form, setForm] = useState(() => {
    if (editingRecord) {
      return {
        farm:               String(editingRecord.farm ?? ''),
        season_year:        editingRecord.season_year ?? CURRENT_YEAR,
        assessment_date:    editingRecord.assessment_date ?? '',
        assessed_by:        editingRecord.assessed_by ?? '',
        overall_risk_level: editingRecord.overall_risk_level ?? 'low',
        water_risk:         { ...EMPTY_CATEGORY, ...(editingRecord.water_risk         || {}) },
        soil_risk:          { ...EMPTY_CATEGORY, ...(editingRecord.soil_risk          || {}) },
        adjacent_land_risk: { ...EMPTY_CATEGORY, ...(editingRecord.adjacent_land_risk || {}) },
        animal_risk:        { ...EMPTY_CATEGORY, ...(editingRecord.animal_risk        || {}) },
        chemical_risk:      { ...EMPTY_CATEGORY, ...(editingRecord.chemical_risk      || {}) },
        mitigation_plan:    editingRecord.mitigation_plan ?? '',
        notes:              editingRecord.notes ?? '',
      };
    }
    return buildEmptyForm();
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [overallManual, setOverallManual] = useState(isEdit);

  // Auto-suggest overall risk whenever category levels change (unless user overrode it)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!overallManual) {
      const suggested = suggestOverallRisk(form);
      setForm((prev) => ({ ...prev, overall_risk_level: suggested }));
    }
  }, [
    form.water_risk?.risk_level,
    form.soil_risk?.risk_level,
    form.adjacent_land_risk?.risk_level,
    form.animal_risk?.risk_level,
    form.chemical_risk?.risk_level,
    overallManual,
  ]);

  const handleCategoryChange = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const handleOverallChange = (val) => {
    setOverallManual(true);
    setForm((prev) => ({ ...prev, overall_risk_level: val }));
  };

  const buildPayload = () => {
    const json = {
      farm:               form.farm ? Number(form.farm) : undefined,
      season_year:        form.season_year ? Number(form.season_year) : undefined,
      assessment_date:    form.assessment_date || undefined,
      assessed_by:        form.assessed_by || undefined,
      overall_risk_level: form.overall_risk_level,
      water_risk:         form.water_risk,
      soil_risk:          form.soil_risk,
      adjacent_land_risk: form.adjacent_land_risk,
      animal_risk:        form.animal_risk,
      chemical_risk:      form.chemical_risk,
      mitigation_plan:    form.mitigation_plan || undefined,
      notes:              form.notes || undefined,
    };

    if (selectedFile) {
      const fd = new FormData();
      fd.append('report_file', selectedFile);
      Object.entries(json).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        if (typeof v === 'object' && !Array.isArray(v)) {
          fd.append(k, JSON.stringify(v));
        } else {
          fd.append(k, v);
        }
      });
      return fd;
    }
    return json;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.farm) { setError('Please select a farm.'); return; }
    if (!form.assessment_date) { setError('Please enter an assessment date.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const payload = buildPayload();
      if (isEdit) {
        await primusGFSAPI.updateFieldRiskAssessment(editingRecord.id, payload);
      } else {
        await primusGFSAPI.createFieldRiskAssessment(payload);
      }
      onSaved();
    } catch (err) {
      const data = err.response?.data;
      const msg = data?.detail
        || (typeof data === 'object' ? JSON.stringify(data) : null)
        || 'Failed to save assessment.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary';
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-primary dark:text-green-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isEdit ? 'Edit Field Risk Assessment' : 'New Field Risk Assessment'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-6">
            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="flex-1">{error}</span>
                <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Basic Info */}
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Basic Information</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Farm <span className="text-red-500">*</span></label>
                  <select
                    value={form.farm}
                    onChange={(e) => setForm((p) => ({ ...p, farm: e.target.value }))}
                    className={inputCls}
                    required
                  >
                    <option value="">Select a farm…</option>
                    {farms.map((f) => (
                      <option key={f.id} value={f.id}>{f.name || `Farm #${f.id}`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Season Year <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    value={form.season_year}
                    onChange={(e) => setForm((p) => ({ ...p, season_year: e.target.value }))}
                    className={inputCls}
                    min="2000"
                    max="2100"
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Assessment Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={form.assessment_date}
                    onChange={(e) => setForm((p) => ({ ...p, assessment_date: e.target.value }))}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Assessed By</label>
                  <input
                    type="text"
                    value={form.assessed_by}
                    onChange={(e) => setForm((p) => ({ ...p, assessed_by: e.target.value }))}
                    className={inputCls}
                    placeholder="Name or role of assessor"
                  />
                </div>
              </div>
            </div>

            {/* Risk Categories */}
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Risk Category Evaluation</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {RISK_CATEGORIES.map((cat) => (
                  <RiskCategoryCard
                    key={cat.key}
                    category={cat}
                    value={form[cat.key]}
                    onChange={(val) => handleCategoryChange(cat.key, val)}
                  />
                ))}
              </div>
            </div>

            {/* Overall Risk */}
            <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Overall Risk Level</p>
                {!overallManual && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 italic">Auto-suggested from categories</span>
                )}
                {overallManual && (
                  <button
                    type="button"
                    onClick={() => {
                      setOverallManual(false);
                      setForm((p) => ({ ...p, overall_risk_level: suggestOverallRisk(p) }));
                    }}
                    className="text-xs text-primary dark:text-green-400 hover:underline"
                  >
                    Reset to suggestion
                  </button>
                )}
              </div>
              <div className="flex gap-3 flex-wrap">
                {RISK_LEVELS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => handleOverallChange(r.value)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border-2 transition ${
                      form.overall_risk_level === r.value
                        ? `${r.badge} border-current shadow-sm`
                        : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${r.dot}`} />
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mitigation Plan */}
            <div>
              <label className={labelCls}>Mitigation Plan</label>
              <textarea
                value={form.mitigation_plan}
                onChange={(e) => setForm((p) => ({ ...p, mitigation_plan: e.target.value }))}
                rows={3}
                className={inputCls}
                placeholder="Describe corrective actions and mitigation strategies for identified risks…"
              />
            </div>

            {/* Notes */}
            <div>
              <label className={labelCls}>Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
                className={inputCls}
                placeholder="Additional observations or context…"
              />
            </div>

            {/* Report File Upload */}
            <div>
              <label className={labelCls}>Report File</label>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                Attach the completed risk assessment report (PDF, JPG, PNG, DOC).
              </p>
              {isEdit && editingRecord.report_file_url && !selectedFile && (
                <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 mb-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">Current file attached</span>
                  <a
                    href={editingRecord.report_file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View
                  </a>
                </div>
              )}
              {selectedFile ? (
                <div className="flex items-center gap-3 bg-primary-light dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <span className="text-sm text-green-800 dark:text-green-300 truncate flex-1">{selectedFile.name}</span>
                  <span className="text-xs text-primary dark:text-green-400">{(selectedFile.size / 1024).toFixed(0)} KB</span>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="p-1 text-primary dark:text-green-400 hover:text-red-600 dark:hover:text-red-400 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label
                  className="flex flex-col items-center gap-2 p-5 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-green-400 dark:hover:border-primary hover:bg-primary-light/50 dark:hover:bg-green-900/10 transition"
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file) setSelectedFile(file);
                  }}
                >
                  <ShieldAlert className="w-6 h-6 text-gray-400" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Drop file here or{' '}
                    <span className="text-primary dark:text-green-400 font-medium">browse</span>
                  </span>
                  <span className="text-xs text-gray-400">PDF, JPG, PNG, DOC up to 25 MB</span>
                  <input
                    type="file"
                    className="sr-only"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setSelectedFile(file);
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create Assessment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function FieldRiskAssessment() {
  const [assessments, setAssessments] = useState([]);
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Filters
  const [farmFilter, setFarmFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');

  // ---- Data fetching ----

  const fetchAssessments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (farmFilter) params.farm = farmFilter;
      if (yearFilter) params.season_year = yearFilter;
      if (riskFilter) params.overall_risk_level = riskFilter;
      const res = await primusGFSAPI.getFieldRiskAssessments(params);
      setAssessments(res.data?.results ?? res.data ?? []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load field risk assessments.');
    } finally {
      setLoading(false);
    }
  }, [farmFilter, yearFilter, riskFilter]);

  const fetchFarms = useCallback(async () => {
    try {
      const res = await farmsAPI.getAll();
      setFarms(res.data?.results ?? res.data ?? []);
    } catch { /* swallow */ }
  }, []);

  useEffect(() => { fetchAssessments(); }, [fetchAssessments]);
  useEffect(() => { fetchFarms(); }, [fetchFarms]);

  // ---- Handlers ----

  const handleSaved = () => {
    setShowModal(false);
    setEditingRecord(null);
    fetchAssessments();
  };

  const openCreate = () => {
    setEditingRecord(null);
    setShowModal(true);
  };

  const openEdit = (record) => {
    setEditingRecord(record);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    try {
      await primusGFSAPI.deleteFieldRiskAssessment(id);
      setDeleteConfirmId(null);
      fetchAssessments();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete assessment.');
    }
  };

  // ---- Summary stats ----

  const stats = {
    total:    assessments.length,
    low:      assessments.filter((a) => a.overall_risk_level === 'low').length,
    medium:   assessments.filter((a) => a.overall_risk_level === 'medium').length,
    high:     assessments.filter((a) => a.overall_risk_level === 'high').length,
    critical: assessments.filter((a) => a.overall_risk_level === 'critical').length,
  };

  // ---- Render ----

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-primary dark:text-green-400" />
            Field Risk Assessment
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            PrimusGFS Doc 39 — Evaluate water, soil, adjacent land, animal, and chemical risks per farm/season.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition text-sm font-medium flex-shrink-0"
        >
          <Plus className="w-4 h-4" /> New Assessment
        </button>
      </div>

      {/* Summary Stats */}
      {!loading && assessments.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.total}</p>
          </div>
          {RISK_LEVELS.map((r) => (
            <div key={r.value} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${r.dot}`} />
                <p className="text-xs text-gray-500 dark:text-gray-400">{r.label}</p>
              </div>
              <p className={`text-2xl font-bold mt-1 ${
                stats[r.value] > 0 && r.value !== 'low'
                  ? r.value === 'critical' ? 'text-red-600 dark:text-red-400'
                  : r.value === 'high'     ? 'text-orange-600 dark:text-orange-400'
                  :                          'text-yellow-600 dark:text-yellow-400'
                  : 'text-gray-900 dark:text-white'
              }`}>
                {stats[r.value]}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={farmFilter}
          onChange={(e) => setFarmFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
        >
          <option value="">All Farms</option>
          {farms.map((f) => (
            <option key={f.id} value={f.id}>{f.name || `Farm #${f.id}`}</option>
          ))}
        </select>

        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
        >
          <option value="">All Risk Levels</option>
          {RISK_LEVELS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>

        <input
          type="number"
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          placeholder="Season year"
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm w-36"
          min="2000"
          max="2100"
        />

        <button
          onClick={fetchAssessments}
          className="p-2 text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Table */}
      {loading && assessments.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-3 text-green-500" />
          Loading field risk assessments…
        </div>
      ) : assessments.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
          <ShieldAlert className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="font-medium text-gray-700 dark:text-gray-300">No field risk assessments found.</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create your first assessment to evaluate field-level risks for PrimusGFS compliance.
          </p>
          <button
            onClick={openCreate}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> New Assessment
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Farm / Assessor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Year</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Category Flags</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Overall Risk</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((a) => (
                  <AssessmentRow
                    key={a.id}
                    assessment={a}
                    farms={farms}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    deleteConfirmId={deleteConfirmId}
                    setDeleteConfirmId={setDeleteConfirmId}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {loading && (
            <div className="flex items-center justify-center py-4 border-t border-gray-100 dark:border-gray-700">
              <Loader2 className="w-4 h-4 animate-spin text-green-500 mr-2" />
              <span className="text-sm text-gray-400">Refreshing…</span>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <AssessmentModal
          editingRecord={editingRecord}
          farms={farms}
          onClose={() => { setShowModal(false); setEditingRecord(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
