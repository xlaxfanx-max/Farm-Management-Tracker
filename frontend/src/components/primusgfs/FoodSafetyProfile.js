import React, { useState, useEffect, useCallback } from 'react';
import {
  User,
  Mail,
  Phone,
  Briefcase,
  FileText,
  Map,
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Upload,
  Paperclip,
  X,
  Clock,
} from 'lucide-react';
import { primusGFSAPI } from '../../services/api';

const formatDate = (str) => {
  if (!str) return '-';
  return new Date(str).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const inputCls =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm transition';

const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const EMPTY_FORM = {
  coordinator_name: '',
  coordinator_title: '',
  coordinator_email: '',
  coordinator_phone: '',
  policy_statement: '',
};

export default function FoodSafetyProfile() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await primusGFSAPI.getFoodSafetyProfile();
      const results = res.data?.results || res.data || [];
      const item = Array.isArray(results) ? results[0] : results;
      setProfile(item || null);
      if (item) {
        setForm({
          coordinator_name: item.coordinator_name || '',
          coordinator_title: item.coordinator_title || '',
          coordinator_email: item.coordinator_email || '',
          coordinator_phone: item.coordinator_phone || '',
          policy_statement: item.policy_statement || '',
        });
      }
    } catch (err) {
      console.error('Failed to load food safety profile:', err);
      setError('Failed to load the Food Safety Profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (saveSuccess) setSaveSuccess(false);
    if (saveError) setSaveError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      let payload;
      if (selectedFile) {
        payload = new FormData();
        payload.append('ranch_map', selectedFile);
        Object.entries(form).forEach(([key, val]) => {
          if (val !== '' && val !== null && val !== undefined) {
            payload.append(key, val);
          }
        });
      } else {
        payload = { ...form };
      }

      const res = await primusGFSAPI.updateFoodSafetyProfile(profile.id, payload);
      const updated = res.data;
      setProfile(updated);
      setForm({
        coordinator_name: updated.coordinator_name || '',
        coordinator_title: updated.coordinator_title || '',
        coordinator_email: updated.coordinator_email || '',
        coordinator_phone: updated.coordinator_phone || '',
        policy_statement: updated.policy_statement || '',
      });
      setSelectedFile(null);
      setSaveSuccess(true);
      // Auto-clear the success banner after 4 seconds
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error('Failed to save food safety profile:', err);
      const detail =
        err.response?.data?.detail ||
        (typeof err.response?.data === 'object'
          ? JSON.stringify(err.response.data)
          : null) ||
        'Failed to save. Please try again.';
      setSaveError(detail);
    } finally {
      setSaving(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
        <span className="ml-3 text-gray-600 dark:text-gray-400 text-sm">
          Loading Food Safety Profile...
        </span>
      </div>
    );
  }

  // Error state (only when no profile exists at all)
  if (error && !profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="w-10 h-10 text-red-500 mb-3" />
        <p className="text-red-600 dark:text-red-400 mb-4 text-sm">{error}</p>
        <button
          onClick={fetchProfile}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  // Profile not found (none returned from API)
  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
        <p className="font-medium text-gray-900 dark:text-white mb-1">
          No Food Safety Profile found
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Please contact your administrator to initialize the profile.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <FileText className="w-6 h-6 text-green-600 dark:text-green-400" />
          Food Safety Profile
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Doc 01 of the CAC Manual — Company-wide food safety coordinator and policy information.
        </p>
      </div>

      {/* Timestamp row */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-400 dark:text-gray-500">
        {profile.created_at && (
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Created: {formatDate(profile.created_at)}
          </span>
        )}
        {profile.updated_at && (
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Last updated: {formatDate(profile.updated_at)}
          </span>
        )}
      </div>

      {/* Non-blocking error banner */}
      {error && profile && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Success banner */}
      {saveSuccess && (
        <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-green-700 dark:text-green-400">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          Food Safety Profile saved successfully.
        </div>
      )}

      {/* Save error banner */}
      {saveError && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{saveError}</span>
          <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Coordinator Information */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
            <User className="w-4 h-4 text-green-500" />
            Food Safety Coordinator
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className={labelCls}>
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                  Coordinator Name
                </span>
              </label>
              <input
                type="text"
                value={form.coordinator_name}
                onChange={(e) => handleChange('coordinator_name', e.target.value)}
                className={inputCls}
                placeholder="Full name"
              />
            </div>

            {/* Title */}
            <div>
              <label className={labelCls}>
                <span className="flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-gray-400" />
                  Title / Position
                </span>
              </label>
              <input
                type="text"
                value={form.coordinator_title}
                onChange={(e) => handleChange('coordinator_title', e.target.value)}
                className={inputCls}
                placeholder="e.g. Food Safety Manager"
              />
            </div>

            {/* Email */}
            <div>
              <label className={labelCls}>
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                  Email Address
                </span>
              </label>
              <input
                type="email"
                value={form.coordinator_email}
                onChange={(e) => handleChange('coordinator_email', e.target.value)}
                className={inputCls}
                placeholder="coordinator@example.com"
              />
            </div>

            {/* Phone */}
            <div>
              <label className={labelCls}>
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  Phone Number
                </span>
              </label>
              <input
                type="tel"
                value={form.coordinator_phone}
                onChange={(e) => handleChange('coordinator_phone', e.target.value)}
                className={inputCls}
                placeholder="(555) 000-0000"
              />
            </div>
          </div>
        </div>

        {/* Food Safety Policy Statement */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
            <FileText className="w-4 h-4 text-green-500" />
            Food Safety Policy Statement
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Describe the company's commitment to food safety, including scope, objectives, and
            management responsibilities.
          </p>
          <textarea
            value={form.policy_statement}
            onChange={(e) => handleChange('policy_statement', e.target.value)}
            rows={6}
            className={inputCls}
            placeholder="Enter the company's food safety policy statement..."
          />
        </div>

        {/* Ranch Map Upload */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
            <Map className="w-4 h-4 text-green-500" />
            Ranch Map
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Upload a map of the ranch showing field locations, water sources, and key facilities.
          </p>

          {/* Current file link */}
          {profile.ranch_map_url && !selectedFile && (
            <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <Paperclip className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">
                Current ranch map
              </span>
              <a
                href={profile.ranch_map_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded hover:bg-green-100 dark:hover:bg-green-900/40 transition"
              >
                View file
              </a>
            </div>
          )}

          {/* Selected new file */}
          {selectedFile && (
            <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <FileText className="w-4 h-4 text-green-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-green-700 dark:text-green-300 truncate font-medium">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  {(selectedFile.size / 1024).toFixed(0)} KB
                  {profile.ranch_map_url ? ' — will replace current file' : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="p-1 text-green-500 hover:text-green-700 dark:hover:text-green-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Drop zone */}
          {!selectedFile && (
            <label
              className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-green-400 dark:hover:border-green-500 hover:bg-green-50/40 dark:hover:bg-green-900/10 transition"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files?.[0];
                if (file) setSelectedFile(file);
              }}
            >
              <Upload className="w-6 h-6 text-gray-400" />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Drop a file here or{' '}
                <span className="text-green-600 dark:text-green-400 font-medium">browse</span>
              </span>
              <span className="text-xs text-gray-400">PDF, JPG, PNG up to 25 MB</span>
              <input
                type="file"
                className="sr-only"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setSelectedFile(file);
                  // Reset input so same file can be re-selected if cleared
                  e.target.value = '';
                }}
              />
            </label>
          )}
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
