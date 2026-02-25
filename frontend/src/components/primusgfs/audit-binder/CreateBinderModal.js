import React, { useState, useEffect } from 'react';
import { X, BookOpen, AlertCircle } from 'lucide-react';
import { primusGFSAPI } from '../../../services/api';
import api from '../../../services/api';

const CreateBinderModal = ({ onClose, onCreate }) => {
  const [templates, setTemplates] = useState([]);
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const currentYear = new Date().getFullYear();
  const [formData, setFormData] = useState({
    template_id: '',
    name: `${currentYear} Audit Binder`,
    season_year: currentYear,
    farm_id: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [templatesRes, farmsRes] = await Promise.all([
        primusGFSAPI.getCACTemplates({ is_active: true }),
        api.get('/farms/'),
      ]);
      const templateList = templatesRes.data.results || templatesRes.data;
      setTemplates(templateList);
      const farmList = farmsRes.data.results || farmsRes.data;
      setFarms(farmList);

      // Auto-select first template if only one
      if (templateList.length === 1) {
        setFormData(prev => ({ ...prev, template_id: templateList[0].id }));
      }
    } catch (err) {
      console.error('Error loading form data:', err);
      setError('Failed to load templates or farms.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.template_id) {
      setError('Please select a template.');
      return;
    }
    if (!formData.name.trim()) {
      setError('Please enter a binder name.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onCreate({
        template_id: parseInt(formData.template_id),
        name: formData.name.trim(),
        season_year: parseInt(formData.season_year),
        farm_id: formData.farm_id ? parseInt(formData.farm_id) : null,
        notes: formData.notes,
      });
    } catch (err) {
      const detail = err.response?.data?.error || err.response?.data?.detail || 'Failed to create binder.';
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              New Audit Binder
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              {/* Template */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Template *
                </label>
                {templates.length === 0 ? (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    No templates found. You need to create a CAC template first.
                  </p>
                ) : (
                  <select
                    value={formData.template_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, template_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  >
                    <option value="">Select a template...</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} (v{t.version})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Binder Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="e.g. 2026 Pre-Season Audit Binder"
                  required
                />
              </div>

              {/* Season Year */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Season Year *
                </label>
                <input
                  type="number"
                  value={formData.season_year}
                  onChange={(e) => setFormData(prev => ({ ...prev, season_year: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                  min={2020}
                  max={2050}
                  required
                />
              </div>

              {/* Farm (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Farm (optional)
                </label>
                <select
                  value={formData.farm_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, farm_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">All farms</option>
                  {farms.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Scope this binder to a specific farm, or leave blank for all farms.
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                  rows={2}
                  placeholder="Optional notes..."
                />
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || templates.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Creating...' : 'Create Binder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateBinderModal;
