import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  X,
  Edit2,
  Trash2,
  Loader2,
  RefreshCw,
  Calendar,
  CheckCircle,
  Sparkles,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { primusGFSAPI } from '../../services/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatDate = (str) => {
  if (!str) return '-';
  return new Date(str).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Normalize attendees: support both old string format and new object format
const normalizeAttendees = (attendees) => {
  if (!Array.isArray(attendees)) return [];
  return attendees.map((a) =>
    typeof a === 'string' ? { name: a, title: '', signed: false } : a
  );
};

// Normalize action items: support both old string format and new object format
const normalizeActionItems = (items) => {
  if (!Array.isArray(items)) return [];
  return items.map((ai) =>
    typeof ai === 'string'
      ? { item: ai, assigned_to: '', due_date: '', status: 'open' }
      : ai
  );
};

const getAttendeeName = (att) => (typeof att === 'string' ? att : att?.name || '');

// ---------------------------------------------------------------------------
// CAC Doc 04 Review Sections — matches backend model fields exactly
// ---------------------------------------------------------------------------

const REVIEW_SECTIONS = [
  {
    key: 'animal_activity',
    label: 'I. Animal Activity',
    reviewedField: 'animal_activity_reviewed',
    notesField: 'animal_activity_notes',
    extraFields: [],
  },
  {
    key: 'pesticide_apps',
    label: 'II. Pesticide / Herbicide Application',
    reviewedField: 'pesticide_apps_reviewed',
    notesField: 'pesticide_apps_notes',
    extraFields: [
      { key: 'pesticide_records_in_binder', label: 'Records in binder', type: 'boolean' },
      { key: 'phi_followed', label: 'PHI followed', type: 'boolean' },
    ],
  },
  {
    key: 'fertilizer_apps',
    label: 'III. Fertilizer Application',
    reviewedField: 'fertilizer_apps_reviewed',
    notesField: 'fertilizer_apps_notes',
    extraFields: [
      { key: 'fertilizer_records_in_binder', label: 'Records in binder', type: 'boolean' },
    ],
  },
  {
    key: 'water_testing',
    label: 'IV. Water Testing',
    reviewedField: 'water_testing_reviewed',
    notesField: 'water_testing_notes',
    extraFields: [
      { key: 'last_irrigation_water_test', label: 'Last irrigation water test', type: 'date' },
      { key: 'last_handwash_water_test', label: 'Last handwash water test', type: 'date' },
      { key: 'water_records_current', label: 'Water records current', type: 'boolean' },
    ],
  },
  {
    key: 'worker_training',
    label: 'V. Worker Training',
    reviewedField: 'worker_training_reviewed',
    notesField: 'worker_training_notes',
    extraFields: [
      { key: 'last_pesticide_training', label: 'Last pesticide training', type: 'date' },
      { key: 'last_food_safety_training', label: 'Last food safety training', type: 'date' },
    ],
  },
];

// All reviewed fields for counting in table
const REVIEWED_FIELDS = REVIEW_SECTIONS.map((s) => s.reviewedField);

const EMPTY_FORM = {
  meeting_date: '',
  meeting_quarter: '',
  meeting_year: '',
  attendees: [],
  // Section I: Animal Activity
  animal_activity_reviewed: false,
  animal_activity_notes: '',
  // Section II: Pesticide / Herbicide
  pesticide_apps_reviewed: false,
  pesticide_apps_notes: '',
  pesticide_records_in_binder: null,
  phi_followed: null,
  // Section III: Fertilizer
  fertilizer_apps_reviewed: false,
  fertilizer_apps_notes: '',
  fertilizer_records_in_binder: null,
  // Section IV: Water Testing
  water_testing_reviewed: false,
  water_testing_notes: '',
  last_irrigation_water_test: '',
  last_handwash_water_test: '',
  water_records_current: null,
  // Section V: Worker Training
  worker_training_reviewed: false,
  worker_training_notes: '',
  last_pesticide_training: '',
  last_food_safety_training: '',
  // General
  additional_topics: '',
  action_items: [],
  status: 'draft',
  next_meeting_date: '',
  notes: '',
};

// ---------------------------------------------------------------------------
// Quarterly Status Bar
// ---------------------------------------------------------------------------

const QuarterlyStatusBar = ({ status }) => {
  if (!status) return null;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
        {status.year || new Date().getFullYear()} Quarterly Meetings
      </p>
      <div className="flex flex-wrap gap-2">
        {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => {
          const val = status[q];
          const done = val === 'completed';
          const draft = val === 'draft';
          const colorCls = done
            ? 'bg-green-100 text-primary dark:bg-green-900/30 dark:text-green-400'
            : draft
            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400';
          const label = done ? 'Done' : draft ? 'Draft' : 'Pending';

          return (
            <span
              key={q}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${colorCls}`}
            >
              {done && <CheckCircle className="w-3.5 h-3.5" />}
              {q}
              <span className="opacity-70 text-xs">{label}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Reviewed sections pill summary (table cell)
// ---------------------------------------------------------------------------

const ReviewedCount = ({ meeting }) => {
  const total = REVIEWED_FIELDS.length;
  const done = REVIEWED_FIELDS.filter((f) => meeting[f]).length;
  const pct = Math.round((done / total) * 100);
  const color =
    pct === 100
      ? 'bg-green-100 text-primary dark:bg-green-900/30 dark:text-green-400'
      : pct >= 50
      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
      : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400';

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {done}/{total} sections
    </span>
  );
};

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

const MeetingModal = ({ editMeeting, onClose, onSave }) => {
  const isEditing = !!editMeeting;

  const [form, setForm] = useState(() => {
    if (editMeeting) {
      return {
        meeting_date: editMeeting.meeting_date || '',
        meeting_quarter: editMeeting.meeting_quarter || '',
        meeting_year: editMeeting.meeting_year || '',
        attendees: normalizeAttendees(editMeeting.attendees),
        animal_activity_reviewed: editMeeting.animal_activity_reviewed || false,
        animal_activity_notes: editMeeting.animal_activity_notes || '',
        pesticide_apps_reviewed: editMeeting.pesticide_apps_reviewed || false,
        pesticide_apps_notes: editMeeting.pesticide_apps_notes || '',
        pesticide_records_in_binder: editMeeting.pesticide_records_in_binder ?? null,
        phi_followed: editMeeting.phi_followed ?? null,
        fertilizer_apps_reviewed: editMeeting.fertilizer_apps_reviewed || false,
        fertilizer_apps_notes: editMeeting.fertilizer_apps_notes || '',
        fertilizer_records_in_binder: editMeeting.fertilizer_records_in_binder ?? null,
        water_testing_reviewed: editMeeting.water_testing_reviewed || false,
        water_testing_notes: editMeeting.water_testing_notes || '',
        last_irrigation_water_test: editMeeting.last_irrigation_water_test || '',
        last_handwash_water_test: editMeeting.last_handwash_water_test || '',
        water_records_current: editMeeting.water_records_current ?? null,
        worker_training_reviewed: editMeeting.worker_training_reviewed || false,
        worker_training_notes: editMeeting.worker_training_notes || '',
        last_pesticide_training: editMeeting.last_pesticide_training || '',
        last_food_safety_training: editMeeting.last_food_safety_training || '',
        additional_topics: editMeeting.additional_topics || '',
        action_items: normalizeActionItems(editMeeting.action_items),
        status: editMeeting.status || 'draft',
        next_meeting_date: editMeeting.next_meeting_date || '',
        notes: editMeeting.notes || '',
      };
    }
    return { ...EMPTY_FORM, attendees: [], action_items: [] };
  });

  const [newAttendee, setNewAttendee] = useState('');
  const [newActionItem, setNewActionItem] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [generatingAgenda, setGeneratingAgenda] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({});

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const toggleSection = (key) =>
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // --- Date change: auto-set meeting_year and suggest quarter ---
  const handleDateChange = (dateStr) => {
    const updates = { meeting_date: dateStr };
    if (dateStr) {
      const d = new Date(dateStr);
      updates.meeting_year = d.getFullYear();
      if (!form.meeting_quarter) {
        const q = Math.ceil((d.getMonth() + 1) / 3);
        updates.meeting_quarter = `Q${q}`;
      }
    }
    setForm((prev) => ({ ...prev, ...updates }));
  };

  // --- Generate Agenda: map ALL prefill data to correct form fields ---
  const generateAgenda = async () => {
    const quarter = form.meeting_quarter || undefined;
    try {
      setGeneratingAgenda(true);
      const res = await primusGFSAPI.getPrefill('committee-agenda', { quarter });
      const agenda = res.data;

      setForm((prev) => ({
        ...prev,
        // Section I: Animal Activity
        animal_activity_reviewed: agenda.animal_activity_reviewed ?? prev.animal_activity_reviewed,
        animal_activity_notes: agenda.animal_activity_notes || prev.animal_activity_notes,
        // Section II: Pesticide / Herbicide
        pesticide_apps_reviewed: agenda.pesticide_apps_reviewed ?? prev.pesticide_apps_reviewed,
        pesticide_apps_notes: agenda.pesticide_apps_notes || prev.pesticide_apps_notes,
        pesticide_records_in_binder: agenda.pesticide_records_in_binder ?? prev.pesticide_records_in_binder,
        phi_followed: agenda.phi_followed ?? prev.phi_followed,
        // Section III: Fertilizer
        fertilizer_apps_reviewed: agenda.fertilizer_apps_reviewed ?? prev.fertilizer_apps_reviewed,
        fertilizer_apps_notes: agenda.fertilizer_apps_notes || prev.fertilizer_apps_notes,
        fertilizer_records_in_binder: agenda.fertilizer_records_in_binder ?? prev.fertilizer_records_in_binder,
        // Section IV: Water Testing
        water_testing_reviewed: agenda.water_testing_reviewed ?? prev.water_testing_reviewed,
        water_testing_notes: agenda.water_testing_notes || prev.water_testing_notes,
        water_records_current: agenda.water_records_current ?? prev.water_records_current,
        last_irrigation_water_test: agenda.last_irrigation_water_test || prev.last_irrigation_water_test,
        // Section V: Worker Training
        worker_training_reviewed: agenda.worker_training_reviewed ?? prev.worker_training_reviewed,
        worker_training_notes: agenda.worker_training_notes || prev.worker_training_notes,
        last_pesticide_training: agenda.last_pesticide_training || prev.last_pesticide_training,
        last_food_safety_training: agenda.last_food_safety_training || prev.last_food_safety_training,
        // Additional
        additional_topics: agenda.additional_topics || prev.additional_topics,
        // Merge action items: existing + carried forward + new suggestions
        action_items: [
          ...prev.action_items,
          ...normalizeActionItems(agenda.carried_forward_items || []),
          ...normalizeActionItems(agenda.action_items || []),
        ],
        // Suggested meeting date from previous quarter
        meeting_date: (!prev.meeting_date && agenda.suggested_meeting_date)
          ? agenda.suggested_meeting_date
          : prev.meeting_date,
        meeting_year: (!prev.meeting_date && agenda.suggested_meeting_date)
          ? new Date(agenda.suggested_meeting_date).getFullYear()
          : prev.meeting_year,
        // Auto-populate attendees from org roles if none set yet
        attendees: prev.attendees.length === 0 && agenda.suggested_attendees?.length > 0
          ? agenda.suggested_attendees
          : prev.attendees,
      }));
    } catch (err) {
      console.error('Failed to generate agenda:', err);
    } finally {
      setGeneratingAgenda(false);
    }
  };

  // --- Load attendees from org roles ---
  const loadOrgRoles = async () => {
    try {
      setLoadingRoles(true);
      const res = await primusGFSAPI.getOrgRoles({ active: true });
      const roles = res.data?.results || res.data || [];
      const existingNames = new Set(form.attendees.map((a) => a.name));
      const newAttendees = roles
        .filter((r) => !existingNames.has(r.person_name))
        .map((r) => ({ name: r.person_name, title: r.role_title, signed: false }));
      set('attendees', [...form.attendees, ...newAttendees]);
    } catch (err) {
      console.error('Failed to load org roles:', err);
    } finally {
      setLoadingRoles(false);
    }
  };

  // --- Attendees ---
  const addAttendee = () => {
    const name = newAttendee.trim();
    if (!name) return;
    set('attendees', [...form.attendees, { name, title: '', signed: false }]);
    setNewAttendee('');
  };

  const removeAttendee = (idx) => {
    set('attendees', form.attendees.filter((_, i) => i !== idx));
  };

  // --- Action Items ---
  const addActionItem = () => {
    const text = newActionItem.trim();
    if (!text) return;
    set('action_items', [
      ...form.action_items,
      { item: text, assigned_to: '', due_date: '', status: 'open' },
    ]);
    setNewActionItem('');
  };

  const removeActionItem = (idx) => {
    set('action_items', form.action_items.filter((_, i) => i !== idx));
  };

  const updateActionItem = (idx, field, value) => {
    setForm((prev) => ({
      ...prev,
      action_items: prev.action_items.map((ai, i) =>
        i === idx ? { ...ai, [field]: value } : ai
      ),
    }));
  };

  // --- Submit ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const payload = { ...form };
      // Ensure meeting_year is set
      if (!payload.meeting_year && payload.meeting_date) {
        payload.meeting_year = new Date(payload.meeting_date).getFullYear();
      }
      await onSave(payload, editMeeting?.id);
      onClose();
    } catch (err) {
      console.error('Failed to save meeting:', err);
      setSaveError(
        err.response?.data?.detail ||
          Object.values(err.response?.data || {})[0] ||
          'Failed to save meeting. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  // Shared input class
  const inputCls =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEditing ? 'Edit Committee Meeting' : 'Record Committee Meeting'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {saveError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-800">
              {saveError}
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Meeting Date *
              </label>
              <input
                type="date"
                required
                value={form.meeting_date}
                onChange={(e) => handleDateChange(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Quarter *
              </label>
              <select
                required
                value={form.meeting_quarter}
                onChange={(e) => set('meeting_quarter', e.target.value)}
                className={inputCls}
              >
                <option value="">Select quarter...</option>
                <option value="Q1">Q1 (Jan – Mar)</option>
                <option value="Q2">Q2 (Apr – Jun)</option>
                <option value="Q3">Q3 (Jul – Sep)</option>
                <option value="Q4">Q4 (Oct – Dec)</option>
              </select>
            </div>
          </div>

          {/* Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
                className={inputCls}
              >
                <option value="draft">Draft</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Next Meeting Date <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="date"
                value={form.next_meeting_date}
                onChange={(e) => set('next_meeting_date', e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Attendees */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Attendees
              </label>
              <button
                type="button"
                onClick={loadOrgRoles}
                disabled={loadingRoles}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary dark:text-green-400 bg-primary-light dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors disabled:opacity-50"
              >
                {loadingRoles ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Users className="w-3 h-3" />
                )}
                Load from Org Roles
              </button>
            </div>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newAttendee}
                onChange={(e) => setNewAttendee(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addAttendee();
                  }
                }}
                placeholder="Add attendee name..."
                className={inputCls}
              />
              <button
                type="button"
                onClick={addAttendee}
                className="flex-shrink-0 px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {form.attendees.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.attendees.map((att, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary-light dark:bg-green-900/20 text-green-800 dark:text-green-300 text-sm rounded-full border border-green-200 dark:border-green-800"
                  >
                    {att.name}
                    {att.title && (
                      <span className="text-primary dark:text-green-500 text-xs">
                        ({att.title})
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAttendee(idx)}
                      className="text-primary hover:text-red-600 dark:text-green-400 dark:hover:text-red-400 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {form.attendees.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500">No attendees added yet.</p>
            )}
          </div>

          {/* Generate Agenda from Platform Data */}
          <button
            type="button"
            onClick={generateAgenda}
            disabled={generatingAgenda}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50"
          >
            {generatingAgenda ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {generatingAgenda ? 'Generating...' : 'Auto-Fill from Platform Data'}
          </button>

          {/* Review Sections (CAC Doc 04) */}
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Review Sections (CAC Doc 04)
            </p>
            <div className="space-y-2">
              {REVIEW_SECTIONS.map((section) => {
                const isCollapsed = collapsedSections[section.key];
                const reviewed = form[section.reviewedField];

                return (
                  <div
                    key={section.key}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                  >
                    {/* Section Header */}
                    <button
                      type="button"
                      onClick={() => toggleSection(section.key)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/40 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        {isCollapsed ? (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                        <input
                          type="checkbox"
                          checked={reviewed}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => set(section.reviewedField, !reviewed)}
                          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary focus:ring-offset-0"
                        />
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {section.label}
                        </span>
                      </div>
                      {reviewed && <CheckCircle className="w-4 h-4 text-green-500" />}
                    </button>

                    {/* Section Body */}
                    {!isCollapsed && (
                      <div className="p-4 space-y-3 border-t border-gray-200 dark:border-gray-700">
                        <textarea
                          value={form[section.notesField]}
                          onChange={(e) => set(section.notesField, e.target.value)}
                          rows={3}
                          placeholder={`Notes on ${section.label.replace(/^[IVX]+\.\s*/, '')}...`}
                          className={inputCls}
                        />
                        {section.extraFields.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {section.extraFields.map((ef) =>
                              ef.type === 'boolean' ? (
                                <label
                                  key={ef.key}
                                  className="flex items-center gap-2.5 cursor-pointer group"
                                >
                                  <input
                                    type="checkbox"
                                    checked={form[ef.key] ?? false}
                                    onChange={() =>
                                      set(ef.key, form[ef.key] ? null : true)
                                    }
                                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary focus:ring-offset-0"
                                  />
                                  <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                                    {ef.label}
                                  </span>
                                </label>
                              ) : (
                                <div key={ef.key}>
                                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                    {ef.label}
                                  </label>
                                  <input
                                    type="date"
                                    value={form[ef.key] || ''}
                                    onChange={(e) => set(ef.key, e.target.value)}
                                    className={inputCls}
                                  />
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Additional Topics */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Additional Topics
            </label>
            <textarea
              value={form.additional_topics}
              onChange={(e) => set('additional_topics', e.target.value)}
              rows={2}
              placeholder="Any additional topics discussed..."
              className={inputCls}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Meeting Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
              placeholder="General meeting notes, decisions made, key points covered..."
              className={inputCls}
            />
          </div>

          {/* Action Items */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Action Items
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newActionItem}
                onChange={(e) => setNewActionItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addActionItem();
                  }
                }}
                placeholder="Add action item..."
                className={inputCls}
              />
              <button
                type="button"
                onClick={addActionItem}
                className="flex-shrink-0 px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {form.action_items.length > 0 && (
              <ul className="space-y-2">
                {form.action_items.map((ai, idx) => (
                  <li
                    key={idx}
                    className="p-3 bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 text-primary dark:text-green-400 text-xs font-semibold flex items-center justify-center mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                        {ai.item}
                      </span>
                      {ai.carried_from && (
                        <span className="flex-shrink-0 text-xs px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 rounded-full">
                          Carried from {ai.carried_from}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeActionItem(idx)}
                        className="flex-shrink-0 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pl-7">
                      <input
                        type="text"
                        placeholder="Assigned to..."
                        value={ai.assigned_to || ''}
                        onChange={(e) =>
                          updateActionItem(idx, 'assigned_to', e.target.value)
                        }
                        className={inputCls}
                      />
                      <input
                        type="date"
                        value={ai.due_date || ''}
                        onChange={(e) =>
                          updateActionItem(idx, 'due_date', e.target.value)
                        }
                        className={inputCls}
                      />
                      <select
                        value={ai.status || 'open'}
                        onChange={(e) =>
                          updateActionItem(idx, 'status', e.target.value)
                        }
                        className={inputCls}
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {form.action_items.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500">No action items added yet.</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Record Meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function CommitteeMeetings() {
  const [meetings, setMeetings] = useState([]);
  const [quarterlyStatus, setQuarterlyStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // ---------- Data Fetching ----------

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [meetingsRes, statusRes] = await Promise.all([
        primusGFSAPI.getCommitteeMeetings({ ordering: '-meeting_date' }),
        primusGFSAPI.quarterlyStatus().catch(() => null),
      ]);
      setMeetings(meetingsRes.data?.results || meetingsRes.data || []);
      if (statusRes) setQuarterlyStatus(statusRes.data);
    } catch (err) {
      console.error('Failed to fetch committee meetings:', err);
      setError('Failed to load committee meetings. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  // ---------- CRUD ----------

  const handleSave = async (payload, meetingId) => {
    if (meetingId) {
      await primusGFSAPI.updateCommitteeMeeting(meetingId, payload);
    } else {
      await primusGFSAPI.createCommitteeMeeting(payload);
    }
    fetchMeetings();
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await primusGFSAPI.deleteCommitteeMeeting(id);
      setConfirmDeleteId(null);
      fetchMeetings();
    } catch (err) {
      console.error('Failed to delete meeting:', err);
      setError('Failed to delete meeting. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  // ---------- Loading State ----------

  if (loading && meetings.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-7 h-7 animate-spin text-primary dark:text-green-400" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading committee meetings...</span>
      </div>
    );
  }

  // ---------- Error State (initial load only) ----------

  if (error && meetings.length === 0) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-8 text-center">
        <p className="text-red-700 dark:text-red-400 mb-4">{error}</p>
        <button
          onClick={fetchMeetings}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  // ---------- Main Render ----------

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-primary dark:text-green-400" />
            Food Safety Committee Meetings
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            CAC Manual Docs 03-04 &mdash; Required quarterly per PrimusGFS
          </p>
        </div>
        <button
          onClick={() => {
            setEditingMeeting(null);
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          Record Meeting
        </button>
      </div>

      {/* Quarterly Status */}
      <QuarterlyStatusBar status={quarterlyStatus} />

      {/* Inline error banner (when data already loaded) */}
      {error && meetings.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!loading && meetings.length === 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="font-medium text-gray-900 dark:text-white">No meetings recorded yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
            Record your first Food Safety Committee meeting to start tracking quarterly compliance.
          </p>
          <button
            onClick={() => {
              setEditingMeeting(null);
              setShowModal(true);
            }}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            Record Meeting
          </button>
        </div>
      )}

      {/* Meetings Table */}
      {meetings.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">
                    <Calendar className="w-3.5 h-3.5 inline-block mr-1.5 opacity-70" />
                    Date
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Quarter</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Attendees</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Sections Reviewed</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">
                    Action Items
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">
                    Next Meeting
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {meetings.map((meeting) => {
                  const attendees = normalizeAttendees(meeting.attendees);
                  const actionItems = normalizeActionItems(meeting.action_items);
                  return (
                    <tr
                      key={meeting.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                    >
                      {/* Date */}
                      <td className="px-4 py-3 text-gray-900 dark:text-white font-medium whitespace-nowrap">
                        {formatDate(meeting.meeting_date)}
                      </td>

                      {/* Quarter */}
                      <td className="px-4 py-3">
                        {meeting.meeting_quarter ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-primary dark:bg-green-900/30 dark:text-green-400">
                            {meeting.meeting_quarter}
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {meeting.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-primary-light text-primary dark:bg-green-900/20 dark:text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
                            Draft
                          </span>
                        )}
                      </td>

                      {/* Attendees */}
                      <td className="px-4 py-3">
                        {attendees.length > 0 ? (
                          <span className="text-gray-700 dark:text-gray-300">
                            {attendees.length === 1
                              ? getAttendeeName(attendees[0])
                              : `${getAttendeeName(attendees[0])} +${attendees.length - 1}`}
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </td>

                      {/* Sections Reviewed */}
                      <td className="px-4 py-3">
                        <ReviewedCount meeting={meeting} />
                      </td>

                      {/* Action Items count */}
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {actionItems.length > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                            {actionItems.length} item{actionItems.length !== 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">None</span>
                        )}
                      </td>

                      {/* Next Meeting */}
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {formatDate(meeting.next_meeting_date)}
                      </td>

                      {/* Row Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingMeeting(meeting);
                              setShowModal(true);
                            }}
                            className="p-1.5 text-primary hover:bg-primary-light dark:hover:bg-green-900/20 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(meeting.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <MeetingModal
          editMeeting={editingMeeting}
          onClose={() => {
            setShowModal(false);
            setEditingMeeting(null);
          }}
          onSave={handleSave}
        />
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setConfirmDeleteId(null)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Meeting?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
              This will permanently remove this committee meeting record. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={deletingId === confirmDeleteId}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deletingId === confirmDeleteId && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
