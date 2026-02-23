import React, { useState, useEffect, useCallback } from 'react';
import {
  ListChecks, Plus, X, Edit2, Trash2, Loader2, RefreshCw, CheckCircle, XCircle,
  ChevronDown, ChevronRight, Sparkles, Database,
} from 'lucide-react';
import { primusGFSAPI } from '../../services/api';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SECTIONS = [
  {
    key: 'management',
    title: 'Management System',
    fields: [
      { key: 'fs_policy_current',          label: 'Food safety policy is current and approved' },
      { key: 'org_chart_current',           label: 'Organizational chart is up to date' },
      { key: 'committee_scheduled',         label: 'Food safety committee meeting scheduled' },
      { key: 'training_plan_ready',         label: 'Annual training plan prepared' },
      { key: 'document_control_current',    label: 'Document control list is current' },
      { key: 'complaint_procedure_ready',   label: 'Complaint handling procedure in place' },
    ],
  },
  {
    key: 'field',
    title: 'Field Preparation',
    fields: [
      { key: 'land_assessment_current',       label: 'Land use history / risk assessment current' },
      { key: 'buffer_zones_marked',           label: 'Buffer zones identified and marked' },
      { key: 'field_signs_posted',            label: 'Field hygiene signs posted at entries' },
      { key: 'previous_use_reviewed',         label: 'Previous crop / land use reviewed' },
      { key: 'soil_amendments_documented',    label: 'Soil amendments and application records documented' },
      { key: 'irrigation_system_inspected',   label: 'Irrigation system inspected before season start' },
    ],
  },
  {
    key: 'water',
    title: 'Water Management',
    fields: [
      { key: 'water_sources_tested',          label: 'Agricultural water sources tested / results on file' },
      { key: 'water_system_maintained',       label: 'Water delivery system maintained and cleaned' },
      { key: 'backflow_preventers_checked',   label: 'Backflow prevention devices inspected' },
      { key: 'water_records_current',         label: 'Water test records and logs are current' },
    ],
  },
  {
    key: 'worker',
    title: 'Worker Health & Hygiene',
    fields: [
      { key: 'sanitation_units_ordered',       label: 'Portable sanitation units ordered / confirmed' },
      { key: 'handwash_stations_ready',        label: 'Handwashing stations stocked and positioned' },
      { key: 'first_aid_kits_stocked',         label: 'First aid kits stocked in all work areas' },
      { key: 'hygiene_training_scheduled',     label: 'Worker hygiene training session scheduled' },
      { key: 'illness_policy_communicated',    label: 'Illness and injury reporting policy communicated' },
      { key: 'visitor_policy_posted',          label: 'Visitor / contractor policy posted' },
    ],
  },
  {
    key: 'pest',
    title: 'Pest & Animal Control',
    fields: [
      { key: 'pest_control_contract_current',  label: 'Pest control contract / log current' },
      { key: 'bait_stations_mapped',           label: 'Bait stations mapped and serviced' },
      { key: 'wildlife_barriers_inspected',    label: 'Wildlife exclusion barriers inspected' },
      { key: 'domestic_animal_policy_posted',  label: 'Domestic animal exclusion policy posted' },
    ],
  },
  {
    key: 'chemical',
    title: 'Chemical Management',
    fields: [
      { key: 'chemical_inventory_current',     label: 'Chemical inventory list is current' },
      { key: 'sds_sheets_available',           label: 'SDS sheets accessible for all chemicals on site' },
      { key: 'spray_equipment_calibrated',     label: 'Spray equipment calibrated and records on file' },
      { key: 'storage_area_secured',           label: 'Chemical storage area secured and labeled' },
      { key: 'ppe_available',                  label: 'PPE available and in good condition' },
      { key: 'chemical_training_completed',    label: 'Chemical handling training completed' },
    ],
  },
];

// Flat list of all boolean field keys
const ALL_CHECK_KEYS = SECTIONS.flatMap((s) => s.fields.map((f) => f.key));
const TOTAL_ITEMS = ALL_CHECK_KEYS.length;

const STATUS_OPTIONS = [
  { value: 'draft',       label: 'Draft' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Completed' },
];

const STATUS_BADGE = {
  draft:       'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  in_progress: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  completed:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatDate = (str) => {
  if (!str) return '-';
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const calcCompletion = (data) => {
  if (!data) return 0;
  const checked = ALL_CHECK_KEYS.filter((k) => data[k] === true).length;
  return Math.round((checked / TOTAL_ITEMS) * 100);
};

const emptyForm = () => ({
  farm: '',
  season_year: new Date().getFullYear(),
  completed_by: '',
  completion_date: '',
  status: 'draft',
  notes: '',
  ...Object.fromEntries(ALL_CHECK_KEYS.map((k) => [k, false])),
});

// ---------------------------------------------------------------------------
// Shared style tokens
// ---------------------------------------------------------------------------

const inputCls =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm';
const textareaCls =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm resize-none';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const StatusBadge = ({ status }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[status] || STATUS_BADGE.draft}`}>
    {(status || 'draft').replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
  </span>
);

const ProgressBar = ({ pct }) => (
  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
    <div
      className={`h-2 rounded-full transition-all ${pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
      style={{ width: `${pct}%` }}
    />
  </div>
);

const SectionCard = ({ section, data, onChange, open, onToggle }) => {
  const sectionChecked = section.fields.filter((f) => data[f.key] === true).length;
  const sectionTotal = section.fields.length;
  const allChecked = sectionChecked === sectionTotal;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${allChecked ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-500'}`} />
          <span className="text-sm font-medium text-gray-900 dark:text-white">{section.title}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({sectionChecked}/{sectionTotal})
          </span>
        </div>
        {open
          ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
          : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>
      {open && (
        <div className="px-4 py-3 space-y-2 bg-white dark:bg-gray-800">
          {section.fields.map((f) => (
            <label key={f.key} className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={!!data[f.key]}
                onChange={(e) => onChange(f.key, e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-green-600 cursor-pointer"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white leading-snug">
                {f.label}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Form modal (create + edit)
// ---------------------------------------------------------------------------

const ChecklistForm = ({ initial, onClose, onSave }) => {
  const [fd, setFd] = useState(initial || emptyForm());
  const [openSections, setOpenSections] = useState(
    Object.fromEntries(SECTIONS.map((s) => [s.key, true]))
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const pct = calcCompletion(fd);

  const [autoFilling, setAutoFilling] = useState(false);
  const [autoFillResult, setAutoFillResult] = useState(null);

  const ch = (e) => {
    const { name, value } = e.target;
    setFd((p) => ({ ...p, [name]: value }));
  };
  const chk = (key, val) => setFd((p) => ({ ...p, [key]: val }));

  const autoFillFromPlatform = async () => {
    try {
      setAutoFilling(true);
      setAutoFillResult(null);
      const params = {};
      if (fd.farm) params.farm_id = fd.farm;
      const res = await primusGFSAPI.getPrefill('pre-season', params);
      const prefill = res.data;

      // Map prefill checks to form keys — the CrossDataLinker uses model field names
      // but we need to map to the frontend form field names
      const mapping = {
        water_tests_current: 'water_sources_tested',
        microbial_tests_conducted: 'water_sources_tested',
        workers_trained: 'hygiene_training_scheduled',
        training_log_current: 'hygiene_training_scheduled',
        pca_qal_license_current: 'chemical_training_completed',
        pesticide_use_reports_current: 'chemical_training_completed',
        chemical_inventory_current: 'chemical_inventory_current',
        perimeter_monitoring_log_current: 'wildlife_barriers_inspected',
        committee_log_current: 'committee_scheduled',
        management_review_current: 'document_control_current',
        first_aid_current: 'first_aid_kits_stocked',
      };

      const updates = {};
      const sources = {};
      for (const [backendKey, frontendKey] of Object.entries(mapping)) {
        if (prefill.checks?.[backendKey]) {
          updates[frontendKey] = true;
          sources[frontendKey] = prefill.sources?.[backendKey] || 'Platform data';
        }
      }

      // Direct name matches
      if (prefill.checks) {
        for (const [key, val] of Object.entries(prefill.checks)) {
          if (val && ALL_CHECK_KEYS.includes(key)) {
            updates[key] = true;
            sources[key] = prefill.sources?.[key] || 'Platform data';
          }
        }
      }

      setFd(prev => ({ ...prev, ...updates }));
      setAutoFillResult({
        checked: Object.keys(updates).length,
        total: TOTAL_ITEMS,
        percent: prefill.percent_prefilled || Math.round((Object.keys(updates).length / TOTAL_ITEMS) * 100),
      });
    } catch (error) {
      console.error('Failed to auto-fill:', error);
      setAutoFillResult({ error: 'Failed to load platform data.' });
    } finally {
      setAutoFilling(false);
    }
  };
  const togSection = (key) => setOpenSections((p) => ({ ...p, [key]: !p[key] }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await onSave(fd);
      onClose();
    } catch (error) {
      setErr(error.response?.data?.detail || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {initial ? 'Edit' : 'New'} Pre-Season Checklist
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-5">
          {err && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg">
              {err}
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Farm ID *
              </label>
              <input
                type="number" name="farm" required value={fd.farm} onChange={ch}
                placeholder="Farm ID" className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Season Year *
              </label>
              <input
                type="number" name="season_year" required value={fd.season_year} onChange={ch}
                min="2000" max="2099" className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Completed By
              </label>
              <input
                type="text" name="completed_by" value={fd.completed_by} onChange={ch}
                placeholder="Name" className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Completion Date
              </label>
              <input
                type="date" name="completion_date" value={fd.completion_date || ''} onChange={ch}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select name="status" value={fd.status} onChange={ch} className={inputCls}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Progress */}
          <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Overall Completion
              </span>
              <span className={`text-sm font-bold ${pct === 100 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300'}`}>
                {pct}%
              </span>
            </div>
            <ProgressBar pct={pct} />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {ALL_CHECK_KEYS.filter((k) => fd[k] === true).length} of {TOTAL_ITEMS} items checked
            </p>
          </div>

          {/* Auto-Fill from Platform Data */}
          <button
            type="button"
            onClick={autoFillFromPlatform}
            disabled={autoFilling}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50"
          >
            {autoFilling ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {autoFilling ? 'Checking platform data...' : 'Auto-Fill from Platform Data'}
          </button>
          {autoFillResult && !autoFillResult.error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm">
              <Database className="w-4 h-4 text-green-600 dark:text-green-400" />
              <span className="text-green-700 dark:text-green-400">
                {autoFillResult.checked} items pre-filled ({autoFillResult.percent}%). {TOTAL_ITEMS - autoFillResult.checked} items need manual review.
              </span>
            </div>
          )}
          {autoFillResult?.error && (
            <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg">
              {autoFillResult.error}
            </div>
          )}

          {/* Checklist sections */}
          <div className="space-y-3">
            {SECTIONS.map((s) => (
              <SectionCard
                key={s.key}
                section={s}
                data={fd}
                onChange={chk}
                open={openSections[s.key]}
                onToggle={() => togSection(s.key)}
              />
            ))}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              name="notes" value={fd.notes || ''} onChange={ch}
              rows={3} placeholder="Additional notes or observations..."
              className={textareaCls}
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button" onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm"
            >
              {saving ? 'Saving...' : initial ? 'Save Changes' : 'Create Checklist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PreSeasonChecklist() {
  const confirm = useConfirm();
  const toast = useToast();
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null); // id being deleted

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await primusGFSAPI.getPreSeasonChecklists({});
      setChecklists(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to fetch pre-season checklists:', err);
      setError('Failed to load checklists. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (formData) => {
    await primusGFSAPI.createPreSeasonChecklist(formData);
    await fetchData();
  };

  const handleUpdate = async (formData) => {
    await primusGFSAPI.updatePreSeasonChecklist(formData.id, formData);
    await fetchData();
  };

  const handleDelete = async (id) => {
    const ok = await confirm({ title: 'Are you sure?', message: 'Delete this pre-season checklist? This action cannot be undone.', confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    setDeleting(id);
    try {
      await primusGFSAPI.deletePreSeasonChecklist(id);
      await fetchData();
    } catch (err) {
      console.error('Failed to delete checklist:', err);
      toast.error('Failed to delete checklist. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  const openEdit = (item) => setEditing(item);

  // Summary stats
  const thisYear = new Date().getFullYear();
  const thisYearItems = checklists.filter((c) => c.season_year === thisYear);
  const completedCount = checklists.filter((c) => c.status === 'completed').length;
  const inProgressCount = checklists.filter((c) => c.status === 'in_progress').length;

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <ListChecks className="w-6 h-6 text-green-600 dark:text-green-400" />
          Pre-Season Food Safety Checklist
        </h2>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" /> New Checklist
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: checklists.length, color: 'text-blue-600 dark:text-blue-400' },
          { label: `${thisYear} Season`, value: thisYearItems.length, color: 'text-purple-600 dark:text-purple-400' },
          { label: 'Completed', value: completedCount, color: 'text-green-600 dark:text-green-400' },
          { label: 'In Progress', value: inProgressCount, color: 'text-yellow-600 dark:text-yellow-400' },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <p className={`text-xs font-medium mb-1 ${s.color}`}>{s.label}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 dark:text-red-400 mb-3">{error}</p>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && !error && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-green-600 animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && checklists.length === 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
          <ListChecks className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="font-medium text-gray-900 dark:text-white">No pre-season checklists yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create your first checklist to prepare for the upcoming season.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" /> New Checklist
          </button>
        </div>
      )}

      {/* Checklist cards */}
      {!loading && !error && checklists.length > 0 && (
        <div className="space-y-3">
          {checklists.map((item) => {
            const pct = calcCompletion(item);
            return (
              <div
                key={item.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5"
              >
                {/* Card header row */}
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-semibold text-gray-900 dark:text-white">
                        {item.season_year} Season
                      </span>
                      {item.farm_name
                        ? <span className="text-sm text-gray-500 dark:text-gray-400">- {item.farm_name}</span>
                        : item.farm
                          ? <span className="text-sm text-gray-500 dark:text-gray-400">- Farm {item.farm}</span>
                          : null}
                      <StatusBadge status={item.status} />
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 space-x-3">
                      {item.completed_by && <span>By: {item.completed_by}</span>}
                      {item.completion_date && <span>Date: {formatDate(item.completion_date)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(item)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deleting === item.id}
                      className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      {deleting === item.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-4 space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Completion</span>
                    <span className={`font-semibold ${pct === 100 ? 'text-green-600 dark:text-green-400' : ''}`}>
                      {pct}%
                    </span>
                  </div>
                  <ProgressBar pct={pct} />
                </div>

                {/* Section breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SECTIONS.map((s) => {
                    const checked = s.fields.filter((f) => item[f.key] === true).length;
                    const total = s.fields.length;
                    const done = checked === total;
                    return (
                      <div
                        key={s.key}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border ${
                          done
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                            : 'bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {done
                          ? <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                          : <XCircle className="w-3.5 h-3.5 shrink-0 text-gray-400" />}
                        <span className="truncate">{s.title}</span>
                        <span className="ml-auto font-medium shrink-0">{checked}/{total}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Notes preview */}
                {item.notes && (
                  <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 italic truncate">
                    Note: {item.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create form modal */}
      {showForm && (
        <ChecklistForm
          initial={null}
          onClose={() => setShowForm(false)}
          onSave={handleCreate}
        />
      )}

      {/* Edit form modal */}
      {editing && (
        <ChecklistForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={handleUpdate}
        />
      )}
    </div>
  );
}
