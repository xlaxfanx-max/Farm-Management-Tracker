/**
 * SeasonTemplatesManager Component
 *
 * Manages season templates for a company. Allows viewing system defaults
 * and creating/editing custom templates for different crop categories.
 */

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { seasonAPI } from '../../services/api';
import { useConfirm } from '../../contexts/ConfirmContext';

// Month options
const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

// Crop category options with descriptions
const CROP_CATEGORIES = [
  { value: 'citrus', label: 'Citrus', description: 'Oranges, lemons, mandarins, grapefruit' },
  { value: 'subtropical', label: 'Subtropical', description: 'Avocados, mangoes, papayas' },
  { value: 'deciduous_fruit', label: 'Deciduous Fruit', description: 'Apples, pears, stone fruit' },
  { value: 'vine', label: 'Vine', description: 'Wine grapes, table grapes' },
  { value: 'nut', label: 'Nut', description: 'Almonds, walnuts, pistachios' },
  { value: 'berry', label: 'Berry', description: 'Strawberries, blueberries, raspberries' },
  { value: 'row_crop', label: 'Row Crop', description: 'Lettuce, tomatoes, peppers' },
  { value: 'vegetable', label: 'Vegetable', description: 'Root vegetables, greens, squash' },
  { value: 'other', label: 'Other', description: 'All other crop types' },
];

// Template card component
const TemplateCard = ({ template, isSystem, onEdit, onDelete, expanded, onToggle }) => {
  const formatCategories = (categories) => {
    if (!categories || categories.length === 0) return 'All crops';
    return categories.map(c => {
      const cat = CROP_CATEGORIES.find(cc => cc.value === c);
      return cat ? cat.label : c;
    }).join(', ');
  };

  return (
    <div className={`border rounded-lg overflow-hidden ${isSystem ? 'border-blue-200 bg-blue-50/50' : 'border-gray-200 bg-white'}`}>
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <Calendar className={`w-5 h-5 ${isSystem ? 'text-blue-500' : 'text-primary'}`} />
          <div>
            <h4 className="font-medium text-gray-900">{template.name}</h4>
            <p className="text-xs text-gray-500">
              {MONTHS[template.start_month - 1]?.label} {template.start_day} • {template.duration_months} months
              {template.crosses_calendar_year && ' • Crosses year'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isSystem && (
            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">System</span>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 py-3 border-t border-gray-200 bg-white">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Season Start:</span>
              <span className="ml-2 text-gray-900">
                {MONTHS[template.start_month - 1]?.label} {template.start_day}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Duration:</span>
              <span className="ml-2 text-gray-900">{template.duration_months} months</span>
            </div>
            <div>
              <span className="text-gray-500">Label Format:</span>
              <span className="ml-2 text-gray-900 font-mono text-xs">{template.label_format}</span>
            </div>
            <div>
              <span className="text-gray-500">Applies to:</span>
              <span className="ml-2 text-gray-900">{formatCategories(template.applicable_categories)}</span>
            </div>
          </div>

          {!isSystem && (
            <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(template); }}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(template); }}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          )}

          {isSystem && (
            <div className="mt-3 flex items-start gap-2 text-xs text-blue-600 bg-blue-50 rounded p-2">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>System templates cannot be edited. Create a custom template to override for your operation.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Template editor modal
const TemplateEditor = ({ template, onSave, onCancel, saving }) => {
  const isEditing = Boolean(template?.id);

  const [formData, setFormData] = useState({
    name: template?.name || '',
    start_month: template?.start_month || 1,
    start_day: template?.start_day || 1,
    duration_months: template?.duration_months || 12,
    crosses_calendar_year: template?.crosses_calendar_year || false,
    label_format: template?.label_format || '{start_year}',
    applicable_categories: template?.applicable_categories || [],
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Auto-update label format based on crosses_calendar_year
    if (field === 'crosses_calendar_year') {
      setFormData(prev => ({
        ...prev,
        [field]: value,
        label_format: value ? '{start_year}-{end_year}' : '{start_year}',
      }));
    }
  };

  const handleCategoryToggle = (category) => {
    setFormData(prev => ({
      ...prev,
      applicable_categories: prev.applicable_categories.includes(category)
        ? prev.applicable_categories.filter(c => c !== category)
        : [...prev.applicable_categories, category],
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  // Generate preview season label
  const getPreviewLabel = () => {
    const year = new Date().getFullYear();
    return formData.label_format
      .replace('{start_year}', year)
      .replace('{end_year}', year + 1);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEditing ? 'Edit Season Template' : 'Create Season Template'}
          </h3>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Template Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., My Citrus Season"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              required
            />
          </div>

          {/* Start Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Month *
              </label>
              <select
                value={formData.start_month}
                onChange={(e) => handleChange('start_month', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              >
                {MONTHS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Day *
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={formData.start_day}
                onChange={(e) => handleChange('start_day', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration (months) *
            </label>
            <input
              type="number"
              min="1"
              max="24"
              value={formData.duration_months}
              onChange={(e) => handleChange('duration_months', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          {/* Crosses Calendar Year */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.crosses_calendar_year}
                onChange={(e) => handleChange('crosses_calendar_year', e.target.checked)}
                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
              />
              <span className="text-sm text-gray-700">
                Season crosses calendar year (e.g., Oct 2024 - Sep 2025)
              </span>
            </label>
          </div>

          {/* Label Format */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Label Format
            </label>
            <input
              type="text"
              value={formData.label_format}
              onChange={(e) => handleChange('label_format', e.target.value)}
              placeholder="{start_year} or {start_year}-{end_year}"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Preview: <span className="font-medium">{getPreviewLabel()}</span>
            </p>
          </div>

          {/* Applicable Categories */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Applies to Crop Categories
            </label>
            <div className="flex flex-wrap gap-2">
              {CROP_CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => handleCategoryToggle(cat.value)}
                  title={cat.description}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    formData.applicable_categories.includes(cat.value)
                      ? 'bg-green-100 border-green-300 text-primary'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {formData.applicable_categories.length === 0
                ? 'No categories selected - template will be available for all crops'
                : `Selected: ${formData.applicable_categories.length} categories`}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !formData.name}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isEditing ? 'Save Changes' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Main component
const SeasonTemplatesManager = () => {
  const confirm = useConfirm();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await seasonAPI.getSeasonTemplates();
      setTemplates(response.data.results || response.data || []);
    } catch (err) {
      console.error('Error fetching templates:', err);
      setError('Failed to load season templates');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    setShowEditor(true);
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setShowEditor(true);
  };

  const handleDelete = async (template) => {
    const ok = await confirm({
      title: 'Are you sure?',
      message: `Are you sure you want to delete "${template.name}"?`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await seasonAPI.deleteSeasonTemplate(template.id);
      setTemplates(prev => prev.filter(t => t.id !== template.id));
      setSuccess('Template deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error deleting template:', err);
      setError('Failed to delete template');
    }
  };

  const handleSave = async (formData) => {
    setSaving(true);
    setError(null);

    try {
      if (editingTemplate?.id) {
        // Update
        const response = await seasonAPI.updateSeasonTemplate(editingTemplate.id, formData);
        setTemplates(prev => prev.map(t =>
          t.id === editingTemplate.id ? response.data : t
        ));
        setSuccess('Template updated successfully');
      } else {
        // Create
        const response = await seasonAPI.createSeasonTemplate(formData);
        setTemplates(prev => [...prev, response.data]);
        setSuccess('Template created successfully');
      }
      setShowEditor(false);
      setEditingTemplate(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error saving template:', err);
      setError(err.response?.data?.detail || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  // Separate system vs custom templates
  const systemTemplates = templates.filter(t => !t.company);
  const customTemplates = templates.filter(t => t.company);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-gray-600">Loading templates...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-gray-900">Season Templates</h3>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Template
        </button>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600">
        Season templates define when each crop's growing season starts and ends.
        This affects harvest tracking, application records, and analytics.
      </p>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-primary-light border border-green-200 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <span className="text-primary text-sm">{success}</span>
        </div>
      )}

      {/* Custom Templates */}
      {customTemplates.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Your Custom Templates</h4>
          <div className="space-y-2">
            {customTemplates.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                isSystem={false}
                onEdit={handleEdit}
                onDelete={handleDelete}
                expanded={expandedId === template.id}
                onToggle={() => setExpandedId(expandedId === template.id ? null : template.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* System Templates */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">System Default Templates</h4>
        <div className="space-y-2">
          {systemTemplates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              isSystem={true}
              onEdit={() => {}}
              onDelete={() => {}}
              expanded={expandedId === template.id}
              onToggle={() => setExpandedId(expandedId === template.id ? null : template.id)}
            />
          ))}
        </div>
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <TemplateEditor
          template={editingTemplate}
          onSave={handleSave}
          onCancel={() => {
            setShowEditor(false);
            setEditingTemplate(null);
          }}
          saving={saving}
        />
      )}
    </div>
  );
};

export default SeasonTemplatesManager;
