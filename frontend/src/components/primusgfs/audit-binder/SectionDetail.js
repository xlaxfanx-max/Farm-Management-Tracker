import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Circle,
  MinusCircle,
  Save,
  Upload,
  Trash2,
  AlertCircle,
  FileText,
  Database,
  Edit3,
  File,
  Download,
  X,
} from 'lucide-react';
import { primusGFSAPI } from '../../../services/api';
import AutoFillPreview from './AutoFillPreview';
import PDFFieldEditor from './PDFFieldEditor';
import PDFPreviewPanel from './PDFPreviewPanel';

// Map BinderSection.doc_number (integer) to DOC_PAGE_MAP key (string).
// Only documents with DOC_PAGE_MAP entries have fillable PDF form fields.
const DOC_NUMBER_TO_PDF_KEY = {
  1: '01', 2: '02', 3: '03', 4: '04', 5: '05',
  6: '06', 9: '09', 11: '11', 14: '14', 15: '15',
  17: '17', 18: '18', 19: '19', 20: '20', 21: '21',
  22: '22', 23: '23', 24: '24', 26: '26', 29: '29',
  37: '37', 38: '38', 39: '39',
};

const SectionDetail = ({ sectionId, onBack }) => {
  const [section, setSection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Editable fields
  const [sopContent, setSopContent] = useState('');
  const [notes, setNotes] = useState('');
  const [sopDirty, setSopDirty] = useState(false);
  const [notesDirty, setNotesDirty] = useState(false);

  // File upload
  const [uploading, setUploading] = useState(false);

  // Tab state: 'details' or 'pdf_editor'
  const [activeTab, setActiveTab] = useState('details');
  // Incremented after each save to trigger PDF preview refresh
  const [pdfRefreshKey, setPdfRefreshKey] = useState(0);

  const loadSection = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await primusGFSAPI.getBinderSection(sectionId);
      setSection(response.data);
      setSopContent(response.data.sop_content || '');
      setNotes(response.data.notes || '');
      setSopDirty(false);
      setNotesDirty(false);
    } catch (err) {
      console.error('Error loading section:', err);
      setError('Failed to load section details.');
    } finally {
      setLoading(false);
    }
  }, [sectionId]);

  useEffect(() => {
    loadSection();
  }, [loadSection]);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleSaveSOP = async () => {
    try {
      setSaving(true);
      const response = await primusGFSAPI.updateSectionSOP(sectionId, { sop_content: sopContent });
      setSection(response.data);
      setSopDirty(false);
      showSuccess('SOP content saved.');
    } catch (err) {
      console.error('Error saving SOP:', err);
      setError('Failed to save SOP content.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotes = async () => {
    try {
      setSaving(true);
      const response = await primusGFSAPI.updateSectionNotes(sectionId, { notes });
      setSection(response.data);
      setNotesDirty(false);
      showSuccess('Notes saved.');
    } catch (err) {
      console.error('Error saving notes:', err);
      setError('Failed to save notes.');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkComplete = async () => {
    try {
      setSaving(true);
      const response = await primusGFSAPI.markSectionComplete(sectionId);
      setSection(response.data);
      showSuccess('Section marked as complete.');
    } catch (err) {
      console.error('Error marking complete:', err);
      setError('Failed to mark section as complete.');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkNA = async () => {
    const reason = window.prompt('Reason for marking as Not Applicable (optional):');
    if (reason === null) return; // cancelled
    try {
      setSaving(true);
      const response = await primusGFSAPI.markSectionNA(sectionId, { reason });
      setSection(response.data);
      showSuccess('Section marked as N/A.');
    } catch (err) {
      console.error('Error marking N/A:', err);
      setError('Failed to mark section as N/A.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetStatus = async () => {
    try {
      setSaving(true);
      const response = await primusGFSAPI.updateBinderSection(sectionId, { status: 'not_started' });
      setSection(response.data);
      showSuccess('Status reset.');
    } catch (err) {
      console.error('Error resetting status:', err);
      setError('Failed to reset status.');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      await primusGFSAPI.uploadBinderDocument({
        section: sectionId,
        file: file,
        file_name: file.name,
      });
      await loadSection();
      showSuccess('Document uploaded.');
    } catch (err) {
      console.error('Error uploading document:', err);
      setError('Failed to upload document.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('Delete this supporting document?')) return;
    try {
      await primusGFSAPI.deleteBinderDocument(docId);
      await loadSection();
      showSuccess('Document deleted.');
    } catch (err) {
      console.error('Error deleting document:', err);
      setError('Failed to delete document.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!section) return null;

  // Determine if this section has PDF form fields
  const pdfKey = DOC_NUMBER_TO_PDF_KEY[section.doc_number];
  const hasPdfFields = !!pdfKey;

  const getStatusBadge = (status) => {
    const config = {
      not_started: { icon: Circle, color: 'text-gray-400', bg: 'bg-gray-100 dark:bg-gray-700', label: 'Not Started' },
      in_progress: { icon: Clock, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'In Progress' },
      complete: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30', label: 'Complete' },
      not_applicable: { icon: MinusCircle, color: 'text-gray-400', bg: 'bg-gray-100 dark:bg-gray-700', label: 'N/A' },
    };
    const c = config[status] || config.not_started;
    const Icon = c.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.color}`}>
        <Icon className="w-3.5 h-3.5" />
        {c.label}
      </span>
    );
  };

  const docTypeInfo = {
    auto_fill: { label: 'Auto-Fill', desc: 'This document can be auto-filled from your system data.', icon: Database },
    partial_fill: { label: 'Partial Auto-Fill', desc: 'Some fields can be auto-filled; others need manual entry.', icon: Database },
    sop: { label: 'SOP / Policy', desc: 'Write your standard operating procedure or policy text below.', icon: Edit3 },
    blank_template: { label: 'Blank Template', desc: 'This is a blank form to be filled on-site during operations. Print from the CAC manual.', icon: FileText },
    reference: { label: 'Reference Material', desc: 'This is reference/educational material from the CAC manual. No action needed.', icon: FileText },
  };
  const typeInfo = docTypeInfo[section.doc_type] || docTypeInfo.reference;
  const TypeIcon = typeInfo.icon;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to sections
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Doc {String(section.doc_number).padStart(2, '0')}: {section.title}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {section.section_group_display}
              </span>
              {getStatusBadge(section.status)}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center justify-between gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-primary-light dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-sm text-primary dark:text-green-400">{successMsg}</span>
        </div>
      )}

      {/* Tab navigation (only show if doc has PDF fields) */}
      {hasPdfFields && (
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'details'
                ? 'border-primary text-primary dark:text-green-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('pdf_editor')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'pdf_editor'
                ? 'border-primary text-primary dark:text-green-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            PDF Editor
            {section.has_pdf_field_data && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            )}
          </button>
        </div>
      )}

      {/* PDF Editor Tab */}
      {activeTab === 'pdf_editor' && hasPdfFields && (
        <div
          className="flex gap-3"
          style={{ height: 'calc(100vh - 320px)', minHeight: '400px' }}
        >
          {/* Left: Field Editor */}
          <div className="w-1/2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <PDFFieldEditor
              sectionId={sectionId}
              docNumber={pdfKey}
              onSaved={() => setPdfRefreshKey(k => k + 1)}
            />
          </div>
          {/* Right: PDF Preview */}
          <div className="w-1/2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <PDFPreviewPanel
              docNumber={pdfKey}
              sectionId={sectionId}
              refreshKey={pdfRefreshKey}
            />
          </div>
        </div>
      )}

      {/* Details Tab (existing content) */}
      {activeTab === 'details' && (
        <div className="space-y-6">
          {/* Document Type Info */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TypeIcon className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{typeInfo.label}</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{typeInfo.desc}</p>

            {/* Auto-fill data source info */}
            {(section.doc_type === 'auto_fill' || section.doc_type === 'partial_fill') && section.auto_fill_source && (
              <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                Data source: <code className="bg-blue-50 dark:bg-blue-900/30 px-1 rounded">{section.auto_fill_source}</code>
              </p>
            )}
          </div>

          {/* Auto-Fill Preview (for auto_fill and partial_fill types) */}
          {(section.doc_type === 'auto_fill' || section.doc_type === 'partial_fill') && section.auto_fill_source && (
            <AutoFillPreview
              sectionId={sectionId}
              autoFillSource={section.auto_fill_source}
              existingData={section.auto_fill_data}
              onApplied={(updatedSection) => {
                setSection(updatedSection);
                showSuccess('Auto-fill data applied.');
              }}
            />
          )}

          {/* SOP Content Editor (for sop type) */}
          {(section.doc_type === 'sop' || section.doc_type === 'partial_fill') && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Edit3 className="w-4 h-4" />
                  {section.doc_type === 'sop' ? 'SOP Content' : 'Notes & Manual Data'}
                </h3>
                <button
                  onClick={handleSaveSOP}
                  disabled={!sopDirty || saving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
              <textarea
                value={sopContent}
                onChange={(e) => {
                  setSopContent(e.target.value);
                  setSopDirty(true);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
                rows={12}
                placeholder="Enter your SOP/policy content here..."
              />
              {sopDirty && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Unsaved changes</p>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Notes</h3>
              <button
                onClick={handleSaveNotes}
                disabled={!notesDirty || saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setNotesDirty(true);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
              rows={3}
              placeholder="Add notes about this section..."
            />
            {notesDirty && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Unsaved changes</p>
            )}
          </div>

          {/* Supporting Documents */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <File className="w-4 h-4" />
                Supporting Documents
              </h3>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                {uploading ? 'Uploading...' : 'Upload'}
                <input
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
                />
              </label>
            </div>

            {section.supporting_documents?.length > 0 ? (
              <div className="space-y-2">
                {section.supporting_documents.map(doc => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-750 rounded-lg"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{doc.file_name}</p>
                        {doc.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{doc.description}</p>
                        )}
                        <p className="text-xs text-gray-400">
                          by {doc.uploaded_by_name || 'Unknown'} - {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      {doc.file_url && (
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
                No supporting documents yet. Upload lab reports, certificates, or other evidence.
              </p>
            )}
          </div>

          {/* Status Actions */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Section Status</h3>
            <div className="flex flex-wrap gap-2">
              {section.status !== 'complete' && (
                <button
                  onClick={handleMarkComplete}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Mark Complete
                </button>
              )}
              {section.status !== 'not_applicable' && (
                <button
                  onClick={handleMarkNA}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                >
                  <MinusCircle className="w-4 h-4" />
                  Mark N/A
                </button>
              )}
              {(section.status === 'complete' || section.status === 'not_applicable') && (
                <button
                  onClick={handleResetStatus}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                >
                  <Circle className="w-4 h-4" />
                  Reset Status
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SectionDetail;
