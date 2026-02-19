import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList,
  Plus,
  X,
  Edit2,
  Trash2,
  Loader2,
  RefreshCw,
  CheckCircle,
  Calendar,
  ChevronDown,
  ChevronRight,
  Upload,
  Paperclip,
  Download,
  AlertTriangle,
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

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getYearOptions = () => {
  const current = new Date().getFullYear();
  return [
    { value: '', label: 'All Years' },
    { value: String(current), label: String(current) },
    { value: String(current - 1), label: String(current - 1) },
    { value: String(current - 2), label: String(current - 2) },
    { value: String(current - 3), label: String(current - 3) },
  ];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'in_review', label: 'In Review' },
  { value: 'completed', label: 'Completed' },
];

const STATUS_BADGE_STYLES = {
  draft: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  in_review: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const STATUS_LABELS = {
  draft: 'Draft',
  in_review: 'In Review',
  completed: 'Completed',
};

const REVIEW_SECTIONS = [
  { key: 'food_safety_policy', label: 'Food Safety Policy', description: 'Review of the food safety policy for continued suitability, adequacy, and effectiveness.' },
  { key: 'food_safety_objectives', label: 'Food Safety Objectives', description: 'Evaluation of progress toward meeting established food safety objectives and targets.' },
  { key: 'audit_results', label: 'Audit Results', description: 'Review of results from internal audits, external audits, and third-party certifications.' },
  { key: 'corrective_actions', label: 'Corrective Actions', description: 'Status and effectiveness of corrective actions taken to address identified non-conformances.' },
  { key: 'customer_complaints', label: 'Customer Complaints', description: 'Analysis of customer feedback, complaints, and related product safety concerns.' },
  { key: 'management_of_change', label: 'Management of Change', description: 'Review of any changes that could affect food safety, including process, equipment, or personnel changes.' },
  { key: 'recall_effectiveness', label: 'Recall Effectiveness', description: 'Evaluation of mock recall exercises and the traceability system\'s performance.' },
  { key: 'training_effectiveness', label: 'Training Effectiveness', description: 'Assessment of food safety training programs and employee competency levels.' },
  { key: 'supplier_performance', label: 'Supplier Performance', description: 'Review of supplier monitoring results, approved supplier lists, and input material quality.' },
  { key: 'regulatory_compliance', label: 'Regulatory Compliance', description: 'Status of compliance with applicable food safety regulations, including FSMA requirements.' },
  { key: 'pest_control_effectiveness', label: 'Pest Control Effectiveness', description: 'Review of pest monitoring results and integrated pest management program performance.' },
  { key: 'sanitation_effectiveness', label: 'Sanitation Effectiveness', description: 'Evaluation of sanitation program results, environmental monitoring, and hygiene compliance.' },
];

const ACCEPTED_FILE_TYPES = '.pdf,.doc,.docx,.xls,.xlsx';

// ---------------------------------------------------------------------------
// Build empty form state
// ---------------------------------------------------------------------------

const buildEmptySections = () => {
  const sections = {};
  REVIEW_SECTIONS.forEach(({ key }) => {
    sections[`${key}_reviewed`] = false;
    sections[`${key}_analysis`] = '';
    sections[`${key}_comments`] = '';
  });
  return sections;
};

const INITIAL_FORM = {
  review_year: new Date().getFullYear(),
  review_date: '',
  conducted_by: '',
  status: 'draft',
  overall_summary: '',
  recommendations: '',
  ...buildEmptySections(),
};

// Populate form from an existing review record
const reviewToForm = (review) => {
  const form = {
    review_year: review.review_year ?? new Date().getFullYear(),
    review_date: review.review_date || '',
    conducted_by: review.conducted_by || '',
    status: review.status || 'draft',
    overall_summary: review.overall_summary || '',
    recommendations: review.recommendations || '',
  };
  REVIEW_SECTIONS.forEach(({ key }) => {
    form[`${key}_reviewed`] = review[`${key}_reviewed`] ?? false;
    form[`${key}_analysis`] = review[`${key}_analysis`] || '';
    form[`${key}_comments`] = review[`${key}_comments`] || '';
  });
  return form;
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const StatusBadge = ({ status }) => (
  <span
    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
      STATUS_BADGE_STYLES[status] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
    }`}
  >
    {STATUS_LABELS[status] || status}
  </span>
);

const inputCls =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm';

const textareaCls =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm resize-none';

// ---------------------------------------------------------------------------
// SectionCard — collapsible card for one of the 12 review sections
// ---------------------------------------------------------------------------

const SectionCard = ({ sectionKey, label, description, formData, onChange }) => {
  const [open, setOpen] = useState(false);

  const reviewedKey = `${sectionKey}_reviewed`;
  const analysisKey = `${sectionKey}_analysis`;
  const commentsKey = `${sectionKey}_comments`;

  const isReviewed = formData[reviewedKey];
  const hasContent = formData[analysisKey] || formData[commentsKey];

  return (
    <div
      className={`border rounded-lg transition-colors ${
        isReviewed
          ? 'border-green-300 dark:border-green-700 bg-green-50/40 dark:bg-green-900/10'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      }`}
    >
      {/* Card header — always visible */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Checkbox (click stops propagation so toggling doesn't collapse the card) */}
          <input
            type="checkbox"
            checked={isReviewed}
            onChange={(e) => {
              e.stopPropagation();
              onChange(reviewedKey, e.target.checked);
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 flex-shrink-0 cursor-pointer"
          />
          <div className="min-w-0">
            <span
              className={`text-sm font-medium ${
                isReviewed
                  ? 'text-green-800 dark:text-green-300 line-through decoration-green-400'
                  : 'text-gray-900 dark:text-white'
              }`}
            >
              {label}
            </span>
            {!open && hasContent && (
              <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">(notes added)</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {isReviewed && (
            <CheckCircle className="w-4 h-4 text-green-500 dark:text-green-400" />
          )}
          {open ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 dark:border-gray-700 pt-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 italic">{description}</p>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Analysis
            </label>
            <textarea
              value={formData[analysisKey]}
              onChange={(e) => onChange(analysisKey, e.target.value)}
              rows={3}
              placeholder={`Summarize findings and analysis for ${label.toLowerCase()}...`}
              className={textareaCls}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Comments
            </label>
            <textarea
              value={formData[commentsKey]}
              onChange={(e) => onChange(commentsKey, e.target.value)}
              rows={2}
              placeholder="Additional comments or follow-up items..."
              className={textareaCls}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// ReviewModal — add / edit modal
// ---------------------------------------------------------------------------

const ReviewModal = ({ editReview, onClose, onSave }) => {
  const [formData, setFormData] = useState(() =>
    editReview ? reviewToForm(editReview) : { ...INITIAL_FORM }
  );
  const [selectedFile, setSelectedFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const isEditing = !!editReview;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    handleChange(name, type === 'checkbox' ? checked : value);
  };

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
        payload.append('report_file', selectedFile);
        Object.entries(formData).forEach(([key, value]) => {
          if (value === null || value === undefined) return;
          if (typeof value === 'boolean') {
            payload.append(key, value ? 'true' : 'false');
          } else {
            payload.append(key, value);
          }
        });
      } else {
        payload = formData;
      }
      await onSave(payload, editReview?.id);
      onClose();
    } catch (err) {
      console.error('Failed to save management review:', err);
      setSaveError(
        err.response?.data?.detail ||
          err.response?.data?.non_field_errors?.[0] ||
          'Failed to save review. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const reviewedCount = REVIEW_SECTIONS.filter(
    ({ key }) => formData[`${key}_reviewed`]
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[92vh] flex flex-col">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isEditing ? 'Edit Management Review' : 'New Management Review'}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Annual Management Verification Review — CAC Manual Doc 05
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable form body */}
        <form
          onSubmit={handleSubmit}
          id="review-form"
          className="flex-1 overflow-y-auto px-6 py-5 space-y-6"
        >
          {saveError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {saveError}
            </div>
          )}

          {/* Basic info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Review Year *
              </label>
              <input
                type="number"
                name="review_year"
                required
                min={2000}
                max={2099}
                value={formData.review_year}
                onChange={handleInputChange}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Review Date *
              </label>
              <input
                type="date"
                name="review_date"
                required
                value={formData.review_date}
                onChange={handleInputChange}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className={inputCls}
              >
                <option value="draft">Draft</option>
                <option value="in_review">In Review</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Conducted By *
            </label>
            <input
              type="text"
              name="conducted_by"
              required
              value={formData.conducted_by}
              onChange={handleInputChange}
              placeholder="Name and title of the person conducting the review"
              className={inputCls}
            />
          </div>

          {/* Review sections */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Review Sections
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {reviewedCount} / {REVIEW_SECTIONS.length} reviewed
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mb-4 overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-300"
                style={{ width: `${(reviewedCount / REVIEW_SECTIONS.length) * 100}%` }}
              />
            </div>

            <div className="space-y-2">
              {REVIEW_SECTIONS.map(({ key, label, description }) => (
                <SectionCard
                  key={key}
                  sectionKey={key}
                  label={label}
                  description={description}
                  formData={formData}
                  onChange={handleChange}
                />
              ))}
            </div>
          </div>

          {/* Overall summary */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Overall Summary
            </label>
            <textarea
              name="overall_summary"
              value={formData.overall_summary}
              onChange={handleInputChange}
              rows={4}
              placeholder="Provide an overall summary of the management review findings, conclusions, and decisions made..."
              className={textareaCls}
            />
          </div>

          {/* Recommendations */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Recommendations
            </label>
            <textarea
              name="recommendations"
              value={formData.recommendations}
              onChange={handleInputChange}
              rows={3}
              placeholder="List recommended improvements, resource needs, or changes to the food safety management system..."
              className={textareaCls}
            />
          </div>

          {/* File upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Report Document
            </label>

            {/* Show current file when editing */}
            {isEditing && editReview.report_file_url && !selectedFile && (
              <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg mb-2">
                <Paperclip className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
                  {editReview.report_file_url.split('/').pop()}
                </span>
                <a
                  href={editReview.report_file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 rounded transition-colors flex-shrink-0"
                >
                  <Download className="w-3 h-3" /> View
                </a>
                <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">Current file</span>
              </div>
            )}

            {selectedFile ? (
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <Paperclip className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                <span className="text-sm text-green-700 dark:text-green-300 truncate flex-1">
                  {selectedFile.name}
                </span>
                <span className="text-xs text-green-600 dark:text-green-400 flex-shrink-0">
                  ({formatFileSize(selectedFile.size)})
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="p-0.5 text-green-600 hover:text-red-600 dark:text-green-400 dark:hover:text-red-400 transition-colors flex-shrink-0"
                  title="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
                className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                  dragOver
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                <input
                  type="file"
                  accept={ACCEPTED_FILE_TYPES}
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="w-6 h-6 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Drop a file here or{' '}
                  <span className="text-green-600 dark:text-green-400 font-medium">browse</span>
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  PDF, Word, or Excel files accepted
                </p>
              </div>
            )}
          </div>
        </form>

        {/* Sticky footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="review-form"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving
              ? isEditing ? 'Saving...' : 'Creating...'
              : isEditing ? 'Save Changes' : 'Create Review'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// ReviewCard — summary card shown in the list view
// ---------------------------------------------------------------------------

const ReviewCard = ({ review, onEdit, onDelete }) => {
  const [expanded, setExpanded] = useState(false);

  const reviewedCount = REVIEW_SECTIONS.filter(
    ({ key }) => review[`${key}_reviewed`]
  ).length;

  const completionPct = Math.round((reviewedCount / REVIEW_SECTIONS.length) * 100);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      {/* Card top */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {review.review_year} Annual Management Review
              </h3>
              <StatusBadge status={review.status} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
              {review.review_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(review.review_date)}
                </span>
              )}
              {review.conducted_by && (
                <span>Conducted by: {review.conducted_by}</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => onEdit(review)}
              className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(review.id)}
              className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Sections reviewed</span>
            <span>{reviewedCount} / {REVIEW_SECTIONS.length} ({completionPct}%)</span>
          </div>
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                completionPct === 100
                  ? 'bg-green-500'
                  : completionPct >= 50
                  ? 'bg-green-400'
                  : 'bg-yellow-400'
              }`}
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>

        {/* Report file badge */}
        {review.report_file_url && (
          <div className="mt-3">
            <a
              href={review.report_file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 rounded-full transition-colors"
            >
              <Paperclip className="w-3 h-3" />
              Report attached
              <Download className="w-3 h-3 ml-0.5" />
            </a>
          </div>
        )}
      </div>

      {/* Expand / collapse toggle */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 border-t border-gray-100 dark:border-gray-700 transition-colors"
      >
        {expanded ? (
          <>
            <ChevronDown className="w-3.5 h-3.5" /> Hide sections
          </>
        ) : (
          <>
            <ChevronRight className="w-3.5 h-3.5" /> Show sections
          </>
        )}
      </button>

      {/* Expanded section detail */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {REVIEW_SECTIONS.map(({ key, label }) => {
              const reviewed = review[`${key}_reviewed`];
              const analysis = review[`${key}_analysis`];
              return (
                <div
                  key={key}
                  className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                    reviewed
                      ? 'bg-green-50 dark:bg-green-900/10'
                      : 'bg-gray-50 dark:bg-gray-700/30'
                  }`}
                >
                  <CheckCircle
                    className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                      reviewed
                        ? 'text-green-500 dark:text-green-400'
                        : 'text-gray-300 dark:text-gray-600'
                    }`}
                  />
                  <div className="min-w-0">
                    <p
                      className={`font-medium ${
                        reviewed
                          ? 'text-green-800 dark:text-green-300'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {label}
                    </p>
                    {analysis && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                        {analysis}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {(review.overall_summary || review.recommendations) && (
            <div className="mt-4 space-y-3 pt-4 border-t border-gray-100 dark:border-gray-700">
              {review.overall_summary && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Overall Summary
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {review.overall_summary}
                  </p>
                </div>
              )}
              {review.recommendations && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Recommendations
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {review.recommendations}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ManagementReview() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterYear, setFilterYear] = useState('');

  const yearOptions = getYearOptions();

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterYear) params.year = filterYear;
      const response = await primusGFSAPI.getManagementReviews(params);
      setReviews(response.data.results || response.data || []);
    } catch (err) {
      console.error('Failed to fetch management reviews:', err);
      setError('Failed to load management reviews. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterYear]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleSave = async (payload, reviewId) => {
    if (reviewId) {
      await primusGFSAPI.updateManagementReview(reviewId, payload);
    } else {
      await primusGFSAPI.createManagementReview(payload);
    }
    fetchReviews();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this management review? This action cannot be undone.')) return;
    try {
      await primusGFSAPI.deleteManagementReview(id);
      fetchReviews();
    } catch (err) {
      console.error('Failed to delete management review:', err);
      setError('Failed to delete review. Please try again.');
    }
  };

  const handleEdit = (review) => {
    setEditingReview(review);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingReview(null);
  };

  // Stat counts
  const completedCount = reviews.filter((r) => r.status === 'completed').length;
  const draftCount = reviews.filter((r) => r.status === 'draft').length;
  const inReviewCount = reviews.filter((r) => r.status === 'in_review').length;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-green-600 dark:text-green-400" />
            Annual Management Review
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            CAC Manual Doc 05 — Annual verification of the food safety management system.
          </p>
        </div>
        <button
          onClick={() => { setEditingReview(null); setShowModal(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Review
        </button>
      </div>

      {/* Summary stats */}
      {!loading && reviews.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{completedCount}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Completed</p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{inReviewCount}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">In Review</p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{draftCount}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Draft</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              {yearOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {(filterStatus || filterYear) && (
            <button
              onClick={() => { setFilterStatus(''); setFilterYear(''); }}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-5 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 dark:text-red-400 mb-3">{error}</p>
          <button
            onClick={fetchReviews}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && !error && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 text-green-600 animate-spin" />
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading reviews...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && reviews.length === 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center">
          <ClipboardList className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="font-semibold text-gray-900 dark:text-white mb-1">No management reviews yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
            Create your first annual management review to document the verification of your food safety management system.
          </p>
          <button
            onClick={() => { setEditingReview(null); setShowModal(true); }}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Create First Review
          </button>
        </div>
      )}

      {/* Review list */}
      {!loading && !error && reviews.length > 0 && (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <ReviewModal
          editReview={editingReview}
          onClose={handleCloseModal}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
