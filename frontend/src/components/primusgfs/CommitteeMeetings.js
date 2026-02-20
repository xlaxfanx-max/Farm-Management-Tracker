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

const QUARTER_LABELS = { 1: 'Q1', 2: 'Q2', 3: 'Q3', 4: 'Q4' };

const REVIEW_TOPICS = [
  { key: 'food_safety_policy_reviewed', label: 'Food Safety Policy' },
  { key: 'food_safety_objectives_reviewed', label: 'Food Safety Objectives' },
  { key: 'audit_results_reviewed', label: 'Audit Results' },
  { key: 'corrective_actions_reviewed', label: 'Corrective Actions' },
  { key: 'customer_complaints_reviewed', label: 'Customer Complaints' },
  { key: 'recall_readiness_reviewed', label: 'Recall Readiness' },
  { key: 'training_needs_reviewed', label: 'Training Needs' },
  { key: 'regulatory_changes_reviewed', label: 'Regulatory Changes' },
];

const EMPTY_FORM = {
  meeting_date: '',
  meeting_quarter: '',
  conducted_by: '',
  attendees: [],
  food_safety_policy_reviewed: false,
  food_safety_objectives_reviewed: false,
  audit_results_reviewed: false,
  corrective_actions_reviewed: false,
  customer_complaints_reviewed: false,
  recall_readiness_reviewed: false,
  training_needs_reviewed: false,
  regulatory_changes_reviewed: false,
  meeting_minutes: '',
  action_items: [],
  next_meeting_date: '',
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
        {[1, 2, 3, 4].map((q) => {
          const done = status[`q${q}_complete`] || status[`Q${q}`] || false;
          return (
            <span
              key={q}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                done
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              }`}
            >
              {done && <CheckCircle className="w-3.5 h-3.5" />}
              {QUARTER_LABELS[q]}
              <span className="opacity-70 text-xs">{done ? 'Done' : 'Pending'}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Reviewed Topics pill summary (table cell)
// ---------------------------------------------------------------------------

const ReviewedCount = ({ meeting }) => {
  const total = REVIEW_TOPICS.length;
  const done = REVIEW_TOPICS.filter((t) => meeting[t.key]).length;
  const pct = Math.round((done / total) * 100);
  const color =
    pct === 100
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      : pct >= 50
      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
      : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400';

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {done}/{total} topics
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
        meeting_quarter: editMeeting.meeting_quarter ?? '',
        conducted_by: editMeeting.conducted_by || '',
        attendees: Array.isArray(editMeeting.attendees) ? [...editMeeting.attendees] : [],
        food_safety_policy_reviewed: editMeeting.food_safety_policy_reviewed || false,
        food_safety_objectives_reviewed: editMeeting.food_safety_objectives_reviewed || false,
        audit_results_reviewed: editMeeting.audit_results_reviewed || false,
        corrective_actions_reviewed: editMeeting.corrective_actions_reviewed || false,
        customer_complaints_reviewed: editMeeting.customer_complaints_reviewed || false,
        recall_readiness_reviewed: editMeeting.recall_readiness_reviewed || false,
        training_needs_reviewed: editMeeting.training_needs_reviewed || false,
        regulatory_changes_reviewed: editMeeting.regulatory_changes_reviewed || false,
        meeting_minutes: editMeeting.meeting_minutes || '',
        action_items: Array.isArray(editMeeting.action_items) ? [...editMeeting.action_items] : [],
        next_meeting_date: editMeeting.next_meeting_date || '',
      };
    }
    return { ...EMPTY_FORM };
  });

  const [newAttendee, setNewAttendee] = useState('');
  const [newActionItem, setNewActionItem] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleBoolChange = (key) => {
    set(key, !form[key]);
  };

  const [generatingAgenda, setGeneratingAgenda] = useState(false);

  const generateAgenda = async () => {
    const quarter = form.meeting_quarter ? `Q${form.meeting_quarter}` : undefined;
    try {
      setGeneratingAgenda(true);
      const res = await primusGFSAPI.getPrefill('committee-agenda', { quarter });
      const agenda = res.data;

      // Build meeting minutes from platform data
      const sections = [];
      if (agenda.pesticide_apps_notes) sections.push(`Pesticide Applications: ${agenda.pesticide_apps_notes}`);
      if (agenda.fertilizer_apps_notes) sections.push(`Fertilizer Applications: ${agenda.fertilizer_apps_notes}`);
      if (agenda.water_testing_notes) sections.push(`Water Testing: ${agenda.water_testing_notes}`);
      if (agenda.worker_training_notes) sections.push(`Worker Training: ${agenda.worker_training_notes}`);
      if (agenda.animal_activity_notes) sections.push(`Animal Activity: ${agenda.animal_activity_notes}`);
      if (agenda.additional_topics) sections.push(`Additional Topics:\n${agenda.additional_topics}`);

      const minutes = sections.length > 0
        ? `Auto-generated agenda for ${agenda.quarter} (${agenda.date_range}):\n\n${sections.join('\n\n')}`
        : form.meeting_minutes;

      setForm(prev => ({
        ...prev,
        meeting_minutes: minutes,
        // Check all review topics since we've covered them
        food_safety_policy_reviewed: true,
        audit_results_reviewed: true,
        corrective_actions_reviewed: true,
        training_needs_reviewed: true,
        // Import action items if available
        action_items: agenda.action_items?.length > 0
          ? [...prev.action_items, ...agenda.action_items.map(ai => ai.item)]
          : prev.action_items,
      }));
    } catch (err) {
      console.error('Failed to generate agenda:', err);
    } finally {
      setGeneratingAgenda(false);
    }
  };

  const addAttendee = () => {
    const name = newAttendee.trim();
    if (!name) return;
    set('attendees', [...form.attendees, name]);
    setNewAttendee('');
  };

  const removeAttendee = (idx) => {
    set('attendees', form.attendees.filter((_, i) => i !== idx));
  };

  const addActionItem = () => {
    const text = newActionItem.trim();
    if (!text) return;
    set('action_items', [...form.action_items, text]);
    setNewActionItem('');
  };

  const removeActionItem = (idx) => {
    set('action_items', form.action_items.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        ...form,
        meeting_quarter: form.meeting_quarter !== '' ? Number(form.meeting_quarter) : null,
      };
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
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
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
                onChange={(e) => set('meeting_date', e.target.value)}
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
                <option value="1">Q1 (Jan – Mar)</option>
                <option value="2">Q2 (Apr – Jun)</option>
                <option value="3">Q3 (Jul – Sep)</option>
                <option value="4">Q4 (Oct – Dec)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Conducted By
            </label>
            <input
              type="text"
              value={form.conducted_by}
              onChange={(e) => set('conducted_by', e.target.value)}
              placeholder="Name of meeting facilitator"
              className={inputCls}
            />
          </div>

          {/* Attendees */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Attendees
            </label>
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
                className="flex-shrink-0 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {form.attendees.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.attendees.map((name, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 text-sm rounded-full border border-green-200 dark:border-green-800"
                  >
                    {name}
                    <button
                      type="button"
                      onClick={() => removeAttendee(idx)}
                      className="text-green-600 hover:text-red-600 dark:text-green-400 dark:hover:text-red-400 transition-colors"
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
            {generatingAgenda ? 'Generating...' : 'Generate Agenda from Platform Data'}
          </button>

          {/* Review Topics */}
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Review Topics</p>
            <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg border border-gray-200 dark:border-gray-700 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {REVIEW_TOPICS.map((topic) => (
                <label
                  key={topic.key}
                  className="flex items-center gap-2.5 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={form[topic.key]}
                    onChange={() => handleBoolChange(topic.key)}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-green-600 focus:ring-green-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                    {topic.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Meeting Minutes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Meeting Minutes
            </label>
            <textarea
              value={form.meeting_minutes}
              onChange={(e) => set('meeting_minutes', e.target.value)}
              rows={4}
              placeholder="Summary of discussion, decisions made, and key points covered..."
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
                className="flex-shrink-0 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {form.action_items.length > 0 && (
              <ul className="space-y-1.5">
                {form.action_items.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 p-2.5 bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                  >
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold flex items-center justify-center mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="flex-1 text-gray-700 dark:text-gray-300">{item}</span>
                    <button
                      type="button"
                      onClick={() => removeActionItem(idx)}
                      className="flex-shrink-0 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {form.action_items.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500">No action items added yet.</p>
            )}
          </div>

          {/* Next Meeting Date */}
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
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
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
        <Loader2 className="w-7 h-7 animate-spin text-green-600 dark:text-green-400" />
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
            <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
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
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex-shrink-0"
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
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
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
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Conducted By</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Attendees</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Topics Reviewed</th>
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
                {meetings.map((meeting) => (
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
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          {QUARTER_LABELS[meeting.meeting_quarter]}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">-</span>
                      )}
                    </td>

                    {/* Conducted By */}
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {meeting.conducted_by || (
                        <span className="text-gray-400 dark:text-gray-500 italic">Not specified</span>
                      )}
                    </td>

                    {/* Attendees */}
                    <td className="px-4 py-3">
                      {Array.isArray(meeting.attendees) && meeting.attendees.length > 0 ? (
                        <span className="text-gray-700 dark:text-gray-300">
                          {meeting.attendees.length === 1
                            ? meeting.attendees[0]
                            : `${meeting.attendees[0]} +${meeting.attendees.length - 1}`}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">-</span>
                      )}
                    </td>

                    {/* Topics Reviewed */}
                    <td className="px-4 py-3">
                      <ReviewedCount meeting={meeting} />
                    </td>

                    {/* Action Items count */}
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {Array.isArray(meeting.action_items) && meeting.action_items.length > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                          {meeting.action_items.length} item{meeting.action_items.length !== 1 ? 's' : ''}
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
                          className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
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
                ))}
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
