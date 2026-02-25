import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Plus, X, Edit2, Trash2, Loader2, RefreshCw, Calendar, Users,
  Upload, Paperclip, Download, AlertTriangle,
} from 'lucide-react';
import { primusGFSAPI } from '../../services/api';
import { useConfirm } from '../../contexts/ConfirmContext';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'food_safety', label: 'Food Safety' },
  { value: 'gmp', label: 'GMP' },
  { value: 'hygiene', label: 'Hygiene' },
  { value: 'chemical_handling', label: 'Chemical Handling' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'first_aid', label: 'First Aid' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'other', label: 'Other' },
];

const LANGUAGE_OPTIONS = [
  { value: 'english', label: 'English' },
  { value: 'spanish', label: 'Spanish' },
  { value: 'both', label: 'Both' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_BADGE_STYLES = {
  food_safety:       'bg-green-100 text-primary dark:bg-green-900/30 dark:text-green-400',
  gmp:               'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  hygiene:           'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  chemical_handling: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  emergency:         'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  first_aid:         'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  equipment:         'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  supervisor:        'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  other:             'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

const categoryLabel = (value) => {
  const opt = CATEGORY_OPTIONS.find((o) => o.value === value);
  return opt ? opt.label : value;
};

const languageLabel = (value) => {
  const opt = LANGUAGE_OPTIONS.find((o) => o.value === value);
  return opt ? opt.label : value;
};

const formatDate = (str) =>
  str
    ? new Date(str).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '-';

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const ACCEPTED_FILE_TYPES = '.pdf,.jpg,.jpeg,.png,.doc,.docx';

// ---------------------------------------------------------------------------
// Shared style strings
// ---------------------------------------------------------------------------

const inputCls =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg ' +
  'bg-white dark:bg-gray-700 text-gray-900 dark:text-white ' +
  'focus:ring-2 focus:ring-primary focus:border-primary';

const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

// ---------------------------------------------------------------------------
// CategoryBadge
// ---------------------------------------------------------------------------

const CategoryBadge = ({ category }) => (
  <span
    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
      CATEGORY_BADGE_STYLES[category] || CATEGORY_BADGE_STYLES.other
    }`}
  >
    {categoryLabel(category)}
  </span>
);

// ---------------------------------------------------------------------------
// INITIAL_FORM
// ---------------------------------------------------------------------------

const INITIAL_FORM = {
  training_date: '',
  training_category: 'food_safety',
  topic: '',
  description: '',
  trainer_name: '',
  trainer_qualifications: '',
  language: 'english',
  duration_hours: '',
  notes: '',
};

// ---------------------------------------------------------------------------
// TrainingSessionModal
// ---------------------------------------------------------------------------

const TrainingSessionModal = ({ session, onClose, onSave }) => {
  const [formData, setFormData] = useState(() => {
    if (session) {
      const f = {};
      Object.keys(INITIAL_FORM).forEach((k) => {
        f[k] = session[k] !== undefined && session[k] !== null ? session[k] : INITIAL_FORM[k];
      });
      return f;
    }
    return { ...INITIAL_FORM };
  });

  // Attendees list (array of strings)
  const [attendees, setAttendees] = useState(() => {
    if (session && Array.isArray(session.attendees)) return session.attendees;
    return [];
  });
  const [attendeeInput, setAttendeeInput] = useState('');

  // File upload
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Attendee helpers
  const addAttendee = () => {
    const name = attendeeInput.trim();
    if (!name) return;
    setAttendees((prev) => [...prev, name]);
    setAttendeeInput('');
  };

  const removeAttendee = (index) => {
    setAttendees((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAttendeeKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addAttendee();
    }
  };

  // File helpers
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      let payload;
      if (selectedFile) {
        payload = new FormData();
        Object.entries(formData).forEach(([key, value]) => {
          if (value !== '' && value !== null && value !== undefined) {
            payload.append(key, value);
          }
        });
        // Attendees as JSON string for FormData
        payload.append('attendees', JSON.stringify(attendees));
        payload.append('sign_in_sheet', selectedFile);
      } else {
        payload = {
          ...formData,
          attendees,
        };
      }
      await onSave(payload, session?.id);
      onClose();
    } catch (err) {
      setSaveError(err.response?.data?.detail || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const title = session ? 'Edit Training Session' : 'New Training Session';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary dark:text-green-400" />
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {saveError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg">
              {saveError}
            </div>
          )}

          {/* Session Info */}
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Session Info
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Training Date *</label>
              <input
                type="date"
                name="training_date"
                required
                value={formData.training_date}
                onChange={handleChange}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Category *</label>
              <select
                name="training_category"
                required
                value={formData.training_category}
                onChange={handleChange}
                className={inputCls}
              >
                {CATEGORY_OPTIONS.filter((o) => o.value).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Topic *</label>
            <input
              type="text"
              name="topic"
              required
              value={formData.topic}
              onChange={handleChange}
              className={inputCls}
              placeholder="e.g. Pesticide Application Safety"
            />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className={inputCls}
              placeholder="What was covered in this training session..."
            />
          </div>

          {/* Trainer Info */}
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider pt-1">
            Trainer Info
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Trainer Name *</label>
              <input
                type="text"
                name="trainer_name"
                required
                value={formData.trainer_name}
                onChange={handleChange}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Trainer Qualifications</label>
              <input
                type="text"
                name="trainer_qualifications"
                value={formData.trainer_qualifications}
                onChange={handleChange}
                className={inputCls}
                placeholder="e.g. Certified Pesticide Applicator"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Language</label>
              <select
                name="language"
                value={formData.language}
                onChange={handleChange}
                className={inputCls}
              >
                {LANGUAGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Duration (hours)</label>
              <input
                type="number"
                name="duration_hours"
                value={formData.duration_hours}
                onChange={handleChange}
                className={inputCls}
                min="0"
                step="0.25"
                placeholder="e.g. 1.5"
              />
            </div>
          </div>

          {/* Attendees */}
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider pt-1">
            Attendees
          </h3>
          <div>
            <label className={labelCls}>
              Add Attendee Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={attendeeInput}
                onChange={(e) => setAttendeeInput(e.target.value)}
                onKeyDown={handleAttendeeKeyDown}
                className={inputCls}
                placeholder="Type a name and press Enter or Add"
              />
              <button
                type="button"
                onClick={addAttendee}
                className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {attendees.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attendees.map((name, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-light dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 rounded-full text-sm"
                >
                  {name}
                  <button
                    type="button"
                    onClick={() => removeAttendee(index)}
                    className="text-green-500 hover:text-primary-hover dark:hover:text-green-100 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {attendees.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">
              No attendees added yet.
            </p>
          )}

          <p className="text-xs text-gray-500 dark:text-gray-400">
            {attendees.length} attendee{attendees.length !== 1 ? 's' : ''} listed
          </p>

          {/* Sign-In Sheet Upload */}
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider pt-1">
            Sign-In Sheet
          </h3>
          <div>
            {session?.sign_in_sheet_url && !selectedFile && (
              <div className="flex items-center gap-2 p-3 bg-primary-light dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg mb-2">
                <Paperclip className="w-4 h-4 text-primary dark:text-green-400 flex-shrink-0" />
                <span className="text-sm text-primary dark:text-green-300 truncate flex-1">
                  Sign-in sheet attached
                </span>
                <a
                  href={session.sign_in_sheet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary dark:text-green-400 hover:underline flex-shrink-0"
                >
                  <Download className="w-3 h-3" /> View
                </a>
                <label className="text-xs text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-green-400 cursor-pointer flex-shrink-0">
                  Replace
                  <input
                    type="file"
                    accept={ACCEPTED_FILE_TYPES}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {selectedFile && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <Paperclip className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <span className="text-sm text-blue-700 dark:text-blue-300 truncate flex-1">
                  {selectedFile.name}
                </span>
                <span className="text-xs text-blue-500 dark:text-blue-400 flex-shrink-0">
                  {formatFileSize(selectedFile.size)}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="p-0.5 text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {!selectedFile && !session?.sign_in_sheet_url && (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-green-400 bg-primary-light dark:bg-green-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-green-400 dark:hover:border-primary bg-gray-50 dark:bg-gray-700/30'
                }`}
              >
                <input
                  type="file"
                  accept={ACCEPTED_FILE_TYPES}
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium text-primary dark:text-green-400">Click to upload</span>{' '}
                  or drag and drop
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  PDF, JPG, PNG, DOC, DOCX
                </p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={2}
              className={inputCls}
              placeholder="Any additional notes..."
            />
          </div>

          {/* Footer */}
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
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving...' : session ? 'Update' : 'Create'}
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

export default function TrainingSessions() {
  const confirm = useConfirm();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [filterCategory, setFilterCategory] = useState('');

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (filterCategory) params.training_category = filterCategory;
      const res = await primusGFSAPI.getTrainingSessions(params);
      setSessions(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to fetch training sessions:', err);
      setError('Failed to load training sessions. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filterCategory]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleSave = async (payload, id) => {
    if (id) {
      await primusGFSAPI.updateTrainingSession(id, payload);
    } else {
      await primusGFSAPI.createTrainingSession(payload);
    }
    fetchSessions();
  };

  const handleDelete = async (id) => {
    const ok = await confirm({ title: 'Are you sure?', message: 'Are you sure you want to delete this training session?', confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    try {
      await primusGFSAPI.deleteTrainingSession(id);
      fetchSessions();
    } catch (err) {
      console.error('Failed to delete training session:', err);
    }
  };

  const openCreate = () => {
    setEditingSession(null);
    setShowModal(true);
  };

  const openEdit = (session) => {
    setEditingSession(session);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingSession(null);
  };

  // Summary stats
  const totalSessions = sessions.length;
  const totalAttendees = sessions.reduce((sum, s) => sum + (s.attendee_count || 0), 0);
  const uniqueCategories = new Set(sessions.map((s) => s.training_category)).size;
  const totalHours = sessions.reduce((sum, s) => sum + (parseFloat(s.duration_hours) || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-primary dark:text-green-400" />
          Worker Training Sessions
        </h2>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Session
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Sessions',
            value: totalSessions,
            icon: BookOpen,
            color: 'text-blue-600 dark:text-blue-400',
          },
          {
            label: 'Total Attendees',
            value: totalAttendees,
            icon: Users,
            color: 'text-primary dark:text-green-400',
          },
          {
            label: 'Categories Covered',
            value: uniqueCategories,
            icon: Calendar,
            color: 'text-purple-600 dark:text-purple-400',
          },
          {
            label: 'Training Hours',
            value: totalHours % 1 === 0 ? totalHours : totalHours.toFixed(1),
            icon: RefreshCw,
            color: 'text-orange-600 dark:text-orange-400',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex items-center gap-3"
          >
            <stat.icon className={`w-8 h-8 ${stat.color}`} />
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-shrink-0">
            Filter by Category:
          </label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {filterCategory && (
            <button
              onClick={() => setFilterCategory('')}
              className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 dark:text-red-400 mb-3">{error}</p>
          <button
            onClick={fetchSessions}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Retry
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
      {!loading && !error && sessions.length === 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
          <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="font-medium text-gray-900 dark:text-white">No training sessions found</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {filterCategory
              ? 'Try a different category filter, or add a new session.'
              : 'Log your first worker training session to start tracking compliance.'}
          </p>
          <button
            onClick={openCreate}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-4 h-4" /> New Session
          </button>
        </div>
      )}

      {/* Table */}
      {!loading && !error && sessions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  {[
                    'Date',
                    'Category',
                    'Topic',
                    'Trainer',
                    'Language',
                    'Duration',
                    'Attendees',
                    'Sign-In',
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300"
                    >
                      {h}
                    </th>
                  ))}
                  <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sessions.map((session) => (
                  <tr
                    key={session.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    {/* Date */}
                    <td className="px-4 py-3 text-gray-900 dark:text-white whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        {formatDate(session.training_date)}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3">
                      <CategoryBadge category={session.training_category} />
                    </td>

                    {/* Topic */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white max-w-[180px] truncate">
                        {session.topic}
                      </div>
                      {session.description && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 max-w-[180px] truncate mt-0.5">
                          {session.description}
                        </div>
                      )}
                    </td>

                    {/* Trainer */}
                    <td className="px-4 py-3">
                      <div className="text-gray-900 dark:text-white">{session.trainer_name || '-'}</div>
                      {session.trainer_qualifications && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[160px]">
                          {session.trainer_qualifications}
                        </div>
                      )}
                    </td>

                    {/* Language */}
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {languageLabel(session.language)}
                    </td>

                    {/* Duration */}
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {session.duration_hours ? `${session.duration_hours} hr` : '-'}
                    </td>

                    {/* Attendees */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                        <Users className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="font-medium">{session.attendee_count || 0}</span>
                      </div>
                    </td>

                    {/* Sign-In Sheet */}
                    <td className="px-4 py-3">
                      {session.sign_in_sheet_url ? (
                        <a
                          href={session.sign_in_sheet_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary dark:text-green-400 hover:underline"
                          title="View sign-in sheet"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          View
                        </a>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(session)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(session.id)}
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

      {/* Modal */}
      {showModal && (
        <TrainingSessionModal
          session={editingSession}
          onClose={closeModal}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
