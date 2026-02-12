import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  ChevronDown,
  ChevronUp,
  Search,
  FileText,
  Beaker,
  Activity,
  Info,
} from 'lucide-react';
import { primusGFSAPI, farmsAPI, fieldsAPI } from '../../services/api';

const formatDate = (str) => {
  if (!str) return '-';
  return new Date(str).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const RISK_LEVELS = [
  { value: 'low', label: 'Low', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', dot: 'bg-green-500' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', dot: 'bg-yellow-500' },
  { value: 'high', label: 'High', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', dot: 'bg-red-500' },
  { value: 'unknown', label: 'Unknown', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400', dot: 'bg-gray-400' },
];

const LAND_USE_OPTIONS = [
  'Agriculture', 'Livestock', 'Industrial', 'Commercial',
  'Residential', 'Vacant', 'Landfill', 'Mining', 'Other',
];

const LAND_USE_COLORS = {
  Agriculture: 'bg-green-500',
  Livestock: 'bg-amber-500',
  Industrial: 'bg-red-500',
  Commercial: 'bg-blue-500',
  Residential: 'bg-purple-500',
  Vacant: 'bg-gray-400',
  Landfill: 'bg-red-700',
  Mining: 'bg-orange-600',
  Other: 'bg-gray-500',
};

const RISK_FACTOR_FIELDS = [
  { key: 'previous_pesticide_use', label: 'Previous Pesticide Use' },
  { key: 'previous_chemical_storage', label: 'Previous Chemical Storage' },
  { key: 'previous_waste_disposal', label: 'Previous Waste Disposal' },
  { key: 'previous_mining', label: 'Previous Mining Activity' },
  { key: 'flood_zone', label: 'Flood Zone' },
  { key: 'adjacent_contamination_risk', label: 'Adjacent Contamination Risk' },
];

const SOIL_PARAMETERS = [
  { key: 'heavy_metals', label: 'Heavy Metals' },
  { key: 'ph', label: 'pH' },
  { key: 'e_coli', label: 'E. coli' },
  { key: 'salmonella', label: 'Salmonella' },
  { key: 'nitrates', label: 'Nitrates' },
  { key: 'phosphorus', label: 'Phosphorus' },
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
  information_source: '',
  previous_animal_operations: false,
  animal_operation_details: '',
  buffer_period_months: '',
  buffer_period_adequate: false,
  soil_testing_conducted: false,
  soil_test_date: '',
  soil_test_passed: false,
  soil_test_lab: '',
  soil_test_parameters_tested: [],
  remediation_required: false,
  remediation_description: '',
  remediation_completion_date: '',
  remediation_verified: false,
  contamination_risk: 'unknown',
  risk_justification: '',
  mitigation_measures: '',
  notes: '',
};

const EMPTY_HISTORY_ENTRY = {
  year_start: '',
  year_end: '',
  land_use: 'Agriculture',
  details: '',
};

// ============================================================================
// SUMMARY STATS BAR
// ============================================================================

const SummaryStatsBar = ({ summary }) => {
  if (!summary) return null;

  const completionPct = summary.total_fields > 0
    ? Math.round((summary.assessed_fields / summary.total_fields) * 100)
    : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
      {/* Fields Assessed */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Fields Assessed</p>
        <p className="text-xl font-bold text-gray-900 dark:text-white">
          {summary.assessed_fields}<span className="text-sm font-normal text-gray-400">/{summary.total_fields}</span>
        </p>
        <div className="mt-2 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>

      {/* Approved */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Approved</p>
        <p className="text-xl font-bold text-green-600 dark:text-green-400">{summary.approved_count}</p>
      </div>

      {/* Pending */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Pending</p>
        <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{summary.pending_count}</p>
      </div>

      {/* Needing Assessment */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Need Assessment</p>
        <p className={`text-xl font-bold ${summary.fields_needing_assessment > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
          {summary.fields_needing_assessment}
        </p>
      </div>

      {/* Risk Distribution */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:col-span-2">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Risk Distribution</p>
        <div className="flex items-center gap-3 flex-wrap">
          {RISK_LEVELS.map((r) => (
            <div key={r.value} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${r.dot}`} />
              <span className="text-xs text-gray-600 dark:text-gray-300">
                {summary.risk_distribution?.[r.value] || 0} {r.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// VISUAL TIMELINE
// ============================================================================

const LandUseTimeline = ({ entries }) => {
  if (!entries || entries.length === 0) return null;

  const sorted = [...entries].sort((a, b) => (a.year_start || 0) - (b.year_start || 0));
  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Land Use Timeline</p>
      <div className="relative pl-4 border-l-2 border-gray-200 dark:border-gray-600 space-y-3">
        {sorted.map((entry, idx) => {
          const color = LAND_USE_COLORS[entry.land_use] || 'bg-gray-500';
          const yearLabel = entry.year_start && entry.year_end
            ? `${entry.year_start} – ${entry.year_end}`
            : entry.year_start
              ? `${entry.year_start} – present`
              : 'Unknown period';

          return (
            <div key={idx} className="relative flex items-start gap-3">
              <div className={`absolute -left-[21px] top-1.5 w-3 h-3 rounded-full ${color} ring-2 ring-white dark:ring-gray-800`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{entry.land_use}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{yearLabel}</span>
                </div>
                {entry.details && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{entry.details}</p>
                )}
              </div>
            </div>
          );
        })}
        {/* Current use marker */}
        <div className="relative flex items-start gap-3">
          <div className="absolute -left-[21px] top-1.5 w-3 h-3 rounded-full bg-green-500 ring-2 ring-white dark:ring-gray-800 animate-pulse" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-green-700 dark:text-green-400">Current Agricultural Use</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{currentYear}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// EXPANDED CARD DETAIL
// ============================================================================

const AssessmentDetail = ({ assessment }) => {
  const a = assessment;

  return (
    <div className="px-5 pb-5 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-5">
      {/* Timeline */}
      {a.land_use_history && a.land_use_history.length > 0 && (
        <LandUseTimeline entries={a.land_use_history} />
      )}

      {/* Risk Factors */}
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Risk Factors</p>
        <div className="grid grid-cols-2 gap-1.5">
          {RISK_FACTOR_FIELDS.map((rf) => {
            const isChecked = a[rf.key] === true;
            return (
              <div key={rf.key} className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${isChecked ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}`}>
                {isChecked ? <AlertTriangle className="w-3 h-3" /> : <span className="w-3 h-3" />}
                <span>{rf.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Information Source */}
      {a.information_source && (
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Source of Information</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{a.information_source}</p>
        </div>
      )}

      {/* Animal Operations */}
      {a.previous_animal_operations && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1">Previous Animal Operations</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{a.animal_operation_details || 'Details not documented'}</p>
        </div>
      )}

      {/* Buffer Period */}
      {a.buffer_period_months != null && (
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500 dark:text-gray-400">Buffer Period:</span>
          <span className="font-medium text-gray-900 dark:text-white">{a.buffer_period_months} months</span>
          {a.buffer_period_adequate != null && (
            a.buffer_period_adequate ? (
              <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-3 h-3" /> Adequate
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                <AlertTriangle className="w-3 h-3" /> Inadequate
              </span>
            )
          )}
        </div>
      )}

      {/* Soil Testing */}
      {a.soil_testing_conducted && (
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Soil Testing</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400 text-xs">Date:</span>
              <p className="text-gray-900 dark:text-white">{formatDate(a.soil_test_date)}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400 text-xs">Result:</span>
              <p className={a.soil_test_passed ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium'}>
                {a.soil_test_passed ? 'Passed' : 'Failed'}
              </p>
            </div>
            {a.soil_test_lab && (
              <div>
                <span className="text-gray-500 dark:text-gray-400 text-xs">Lab:</span>
                <p className="text-gray-900 dark:text-white">{a.soil_test_lab}</p>
              </div>
            )}
          </div>
          {a.soil_test_parameters_tested && a.soil_test_parameters_tested.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {a.soil_test_parameters_tested.map((p) => {
                const param = SOIL_PARAMETERS.find((sp) => sp.key === p);
                return (
                  <span key={p} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded text-xs">
                    {param ? param.label : p}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Remediation */}
      {a.remediation_required && (
        <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-orange-700 dark:text-orange-400 uppercase tracking-wide">Remediation Required</p>
            {a.remediation_verified ? (
              <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-3 h-3" /> Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <Clock className="w-3 h-3" /> Pending Verification
              </span>
            )}
          </div>
          {a.remediation_description && (
            <p className="text-sm text-gray-700 dark:text-gray-300">{a.remediation_description}</p>
          )}
          {a.remediation_completion_date && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Completed: {formatDate(a.remediation_completion_date)}</p>
          )}
        </div>
      )}

      {/* Risk Justification & Mitigation */}
      {a.risk_justification && (
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Risk Justification</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{a.risk_justification}</p>
        </div>
      )}
      {a.mitigation_measures && (
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Mitigation Measures</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{a.mitigation_measures}</p>
        </div>
      )}

      {/* Notes */}
      {a.notes && (
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Notes</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{a.notes}</p>
        </div>
      )}

      {/* Approval info */}
      {a.approved && a.approved_by_name && (
        <div className="text-xs text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-100 dark:border-gray-700">
          Approved by {a.approved_by_name} on {formatDate(a.approved_at)}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function LandHistoryForm() {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedData, setExpandedData] = useState({}); // full detail keyed by id
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Filter state
  const [farms, setFarms] = useState([]);
  const [fields, setFields] = useState([]);
  const [selectedFarm, setSelectedFarm] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [approvedFilter, setApprovedFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [formFields, setFormFields] = useState([]);
  const [formFarm, setFormFarm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Summary state
  const [summary, setSummary] = useState(null);

  // ---- Data fetching ----

  const fetchAssessments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedFarm) params.farm_id = selectedFarm;
      if (riskFilter) params.contamination_risk = riskFilter;
      if (approvedFilter) params.approved = approvedFilter;
      if (searchTerm) params.search = searchTerm;
      const res = await primusGFSAPI.getLandAssessments(params);
      setAssessments(res.data?.results || res.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load land assessments.');
    } finally {
      setLoading(false);
    }
  }, [selectedFarm, riskFilter, approvedFilter, searchTerm]);

  const fetchFarms = useCallback(async () => {
    try {
      const res = await farmsAPI.getAll();
      setFarms(res.data?.results || res.data || []);
    } catch { /* swallow */ }
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await primusGFSAPI.getLandAssessmentSummary();
      setSummary(res.data);
    } catch { /* swallow */ }
  }, []);

  useEffect(() => { fetchAssessments(); }, [fetchAssessments]);
  useEffect(() => { fetchFarms(); }, [fetchFarms]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // Fetch fields for the form when a farm is selected in the form
  useEffect(() => {
    if (!formFarm) {
      setFormFields([]);
      return;
    }
    const load = async () => {
      try {
        const res = await farmsAPI.getFields(formFarm);
        setFormFields(res.data?.results || res.data || []);
      } catch {
        setFormFields([]);
      }
    };
    load();
  }, [formFarm]);

  // ---- Handlers ----

  const handleExpand = async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    // Fetch full detail if we don't already have it cached
    if (!expandedData[id]) {
      try {
        const res = await primusGFSAPI.getLandAssessment(id);
        setExpandedData((prev) => ({ ...prev, [id]: res.data }));
      } catch {
        // Fall back to list data if detail fetch fails
      }
    }
  };

  const handleApprove = async (id) => {
    try {
      await primusGFSAPI.approveLandAssessment(id);
      // Clear cached detail so expanded view refreshes
      setExpandedData((prev) => { const next = { ...prev }; delete next[id]; return next; });
      fetchAssessments();
      fetchSummary();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to approve assessment.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await primusGFSAPI.deleteLandAssessment(id);
      setDeleteConfirmId(null);
      setExpandedId(null);
      fetchAssessments();
      fetchSummary();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete assessment.');
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setFormData({ ...EMPTY_FORM });
    setFormFarm('');
    setShowModal(true);
  };

  const openEdit = async (assessment) => {
    setEditingId(assessment.id);
    // Fetch full detail for editing
    try {
      const res = await primusGFSAPI.getLandAssessment(assessment.id);
      const a = res.data;
      setFormData({
        field: a.field || '',
        assessment_date: a.assessment_date || '',
        land_use_history: a.land_use_history || [],
        previous_pesticide_use: a.previous_pesticide_use || false,
        previous_chemical_storage: a.previous_chemical_storage || false,
        previous_waste_disposal: a.previous_waste_disposal || false,
        previous_mining: a.previous_mining || false,
        flood_zone: a.flood_zone || false,
        adjacent_contamination_risk: a.adjacent_contamination_risk || false,
        information_source: a.information_source || '',
        previous_animal_operations: a.previous_animal_operations || false,
        animal_operation_details: a.animal_operation_details || '',
        buffer_period_months: a.buffer_period_months ?? '',
        buffer_period_adequate: a.buffer_period_adequate || false,
        soil_testing_conducted: a.soil_testing_conducted || false,
        soil_test_date: a.soil_test_date || '',
        soil_test_passed: a.soil_test_passed || false,
        soil_test_lab: a.soil_test_lab || '',
        soil_test_parameters_tested: a.soil_test_parameters_tested || [],
        remediation_required: a.remediation_required || false,
        remediation_description: a.remediation_description || '',
        remediation_completion_date: a.remediation_completion_date || '',
        remediation_verified: a.remediation_verified || false,
        contamination_risk: a.contamination_risk || 'unknown',
        risk_justification: a.risk_justification || '',
        mitigation_measures: a.mitigation_measures || '',
        notes: a.notes || '',
      });
      // Set the form farm to load the correct fields dropdown
      if (a.farm_name) {
        const farm = farms.find((f) => f.name === a.farm_name);
        if (farm) setFormFarm(String(farm.id));
      }
      setShowModal(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load assessment for editing.');
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleToggle = (field) => {
    setFormData((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleToggleSoilParam = (paramKey) => {
    setFormData((prev) => {
      const current = prev.soil_test_parameters_tested || [];
      if (current.includes(paramKey)) {
        return { ...prev, soil_test_parameters_tested: current.filter((p) => p !== paramKey) };
      }
      return { ...prev, soil_test_parameters_tested: [...current, paramKey] };
    });
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        await primusGFSAPI.updateLandAssessment(editingId, formData);
        // Clear cached detail so expanded view refreshes
        setExpandedData((prev) => { const next = { ...prev }; delete next[editingId]; return next; });
      } else {
        await primusGFSAPI.createLandAssessment(formData);
      }
      setShowModal(false);
      setFormData({ ...EMPTY_FORM });
      setEditingId(null);
      fetchAssessments();
      fetchSummary();
    } catch (err) {
      const detail = err.response?.data?.detail
        || (typeof err.response?.data === 'object' ? JSON.stringify(err.response.data) : null)
        || 'Failed to save assessment.';
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Render ----

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
        <button onClick={fetchAssessments} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
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
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> New Assessment
        </button>
      </div>

      {/* Summary Stats */}
      <SummaryStatsBar summary={summary} />

      {/* Toolbar / Filters */}
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

        <select
          value={approvedFilter}
          onChange={(e) => setApprovedFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
        >
          <option value="">All Status</option>
          <option value="true">Approved</option>
          <option value="false">Pending</option>
        </select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search field name..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
          />
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Assessment List — Expandable Cards */}
      {assessments.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <Map className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No land assessments found.</p>
          <p className="text-sm mt-1">Create a new assessment to document land history.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map((a) => {
            const isExpanded = expandedId === a.id;
            return (
              <div
                key={a.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
              >
                {/* Card Header — always visible */}
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                  onClick={() => handleExpand(a.id)}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {a.field_name || `Field #${a.field}`}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {a.farm_name || '-'} &middot; {formatDate(a.assessment_date)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    {a.remediation_required && !a.remediation_verified && (
                      <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                        Remediation Pending
                      </span>
                    )}
                    <RiskBadge level={a.contamination_risk} />
                    {a.approved ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <CheckCircle2 className="w-3 h-3" /> Approved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                        <Clock className="w-3 h-3" /> Pending
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <>
                    <AssessmentDetail assessment={expandedData[a.id] || a} />

                    {/* Action buttons */}
                    <div className="px-5 pb-4 flex items-center gap-2 border-t border-gray-100 dark:border-gray-700 pt-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(a); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
                      >
                        <Edit className="w-3.5 h-3.5" /> Edit
                      </button>

                      {!a.approved && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleApprove(a.id); }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </button>
                      )}

                      {deleteConfirmId === a.id ? (
                        <div className="flex items-center gap-2 ml-auto">
                          <span className="text-xs text-red-600 dark:text-red-400">Delete this assessment?</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(a.id); }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition ml-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700 z-10">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingId ? 'Edit Land History Assessment' : 'New Land History Assessment'}
              </h3>
              <button onClick={() => { setShowModal(false); setEditingId(null); }} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-5">
              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Farm</label>
                  <select
                    value={formFarm}
                    onChange={(e) => { setFormFarm(e.target.value); handleChange('field', ''); }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                  >
                    <option value="">Select Farm</option>
                    {farms.map((farm) => (
                      <option key={farm.id} value={farm.id}>{farm.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Field</label>
                  <select
                    value={formData.field}
                    onChange={(e) => handleChange('field', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                    required
                    disabled={!formFarm}
                  >
                    <option value="">{formFarm ? 'Select Field' : 'Select a farm first'}</option>
                    {formFields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}{f.acres ? ` (${f.acres} ac)` : ''}
                      </option>
                    ))}
                  </select>
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

              {/* Source of Information */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Source of Information</label>
                <input
                  type="text"
                  value={formData.information_source}
                  onChange={(e) => handleChange('information_source', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                  placeholder="County records, property deed, owner interview, site observation..."
                />
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
                  <p className="text-xs text-gray-400 dark:text-gray-500 italic">No land use history entries. Click &ldquo;Add Entry&rdquo; to begin.</p>
                )}
                <div className="space-y-3">
                  {formData.land_use_history.map((entry, idx) => (
                    <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2 bg-gray-50 dark:bg-gray-900/50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Entry {idx + 1}</span>
                        <button type="button" onClick={() => removeHistoryEntry(idx)} className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
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
                        onChange={() => handleToggle(rf.key)}
                        className="rounded border-gray-300 text-blue-600 dark:border-gray-600 dark:bg-gray-900"
                      />
                      <span className="text-gray-700 dark:text-gray-300 text-xs">{rf.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Animal Operations History */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.previous_animal_operations}
                    onChange={() => handleToggle('previous_animal_operations')}
                    className="rounded border-gray-300 text-blue-600 dark:border-gray-600 dark:bg-gray-900"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Previous Animal Operations</span>
                </label>
                {formData.previous_animal_operations && (
                  <div className="pl-6">
                    <textarea
                      value={formData.animal_operation_details}
                      onChange={(e) => handleChange('animal_operation_details', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                      placeholder="Type of animals, duration of operations, manure management practices..."
                    />
                  </div>
                )}
              </div>

              {/* Buffer Period */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Buffer Period (months)</label>
                  <input
                    type="number"
                    value={formData.buffer_period_months}
                    onChange={(e) => handleChange('buffer_period_months', e.target.value ? parseInt(e.target.value) : '')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                    placeholder="Months between prior use and production"
                    min="0"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.buffer_period_adequate}
                      onChange={() => handleToggle('buffer_period_adequate')}
                      className="rounded border-gray-300 text-green-600 dark:border-gray-600 dark:bg-gray-900"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Buffer period adequate</span>
                  </label>
                </div>
              </div>

              {/* Soil Testing */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.soil_testing_conducted}
                    onChange={() => handleToggle('soil_testing_conducted')}
                    className="rounded border-gray-300 text-blue-600 dark:border-gray-600 dark:bg-gray-900"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Soil Testing Conducted</span>
                </label>
                {formData.soil_testing_conducted && (
                  <div className="space-y-3 pl-6">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Test Date</label>
                        <input
                          type="date"
                          value={formData.soil_test_date}
                          onChange={(e) => handleChange('soil_test_date', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Lab Name</label>
                        <input
                          type="text"
                          value={formData.soil_test_lab}
                          onChange={(e) => handleChange('soil_test_lab', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs"
                          placeholder="Lab name"
                        />
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 cursor-pointer pb-1">
                          <input
                            type="checkbox"
                            checked={formData.soil_test_passed}
                            onChange={() => handleToggle('soil_test_passed')}
                            className="rounded border-gray-300 text-green-600 dark:border-gray-600 dark:bg-gray-900"
                          />
                          <span className="text-xs text-gray-700 dark:text-gray-300">Test Passed</span>
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Parameters Tested</label>
                      <div className="flex flex-wrap gap-2">
                        {SOIL_PARAMETERS.map((sp) => (
                          <label
                            key={sp.key}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs cursor-pointer transition ${
                              formData.soil_test_parameters_tested.includes(sp.key)
                                ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                                : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={formData.soil_test_parameters_tested.includes(sp.key)}
                              onChange={() => handleToggleSoilParam(sp.key)}
                              className="sr-only"
                            />
                            {sp.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Remediation */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.remediation_required}
                    onChange={() => handleToggle('remediation_required')}
                    className="rounded border-gray-300 text-orange-600 dark:border-gray-600 dark:bg-gray-900"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Remediation Required</span>
                </label>
                {formData.remediation_required && (
                  <div className="space-y-3 pl-6">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Remediation Description</label>
                      <textarea
                        value={formData.remediation_description}
                        onChange={(e) => handleChange('remediation_description', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                        placeholder="Describe remediation steps taken or planned..."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Completion Date</label>
                        <input
                          type="date"
                          value={formData.remediation_completion_date}
                          onChange={(e) => handleChange('remediation_completion_date', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs"
                        />
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 cursor-pointer pb-1">
                          <input
                            type="checkbox"
                            checked={formData.remediation_verified}
                            onChange={() => handleToggle('remediation_verified')}
                            className="rounded border-gray-300 text-green-600 dark:border-gray-600 dark:bg-gray-900"
                          />
                          <span className="text-xs text-gray-700 dark:text-gray-300">Remediation Verified</span>
                        </label>
                      </div>
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

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                  placeholder="Additional notes..."
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingId(null); }}
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
                  {editingId ? 'Save Changes' : 'Create Assessment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
