import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Save,
  RotateCcw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  Edit3,
  Circle,
} from 'lucide-react';
import { primusGFSAPI } from '../../../services/api';

const SOURCE_BADGES = {
  auto_fill: { label: 'Auto-fill', color: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30' },
  user_override: { label: 'Edited', color: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/30' },
  empty: { label: 'Empty', color: 'text-gray-400 bg-gray-50 dark:text-gray-500 dark:bg-gray-800' },
};

/**
 * PDFFieldEditor -- Left panel of the two-panel PDF editor.
 *
 * Fetches the field schema for a document section from the backend,
 * renders HTML form inputs for each field (text + checkboxes),
 * and saves changes back as structured JSON.
 */
const PDFFieldEditor = ({ sectionId, docNumber, onSaved }) => {
  const [fields, setFields] = useState([]);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Local field values (working copy)
  const [localValues, setLocalValues] = useState({});
  // Track which fields have been changed since last save
  const [dirtyFields, setDirtyFields] = useState({});
  // Track collapsed page groups
  const [collapsedPages, setCollapsedPages] = useState({});

  // Auto-save refs
  const [autoSave, setAutoSave] = useState(false);
  const autoSaveTimer = useRef(null);

  // Load field schema
  const loadSchema = useCallback(async () => {
    if (!docNumber || !sectionId) return;
    try {
      setLoading(true);
      setError(null);
      const response = await primusGFSAPI.getCACFieldSchema(docNumber, sectionId);
      const data = response.data;
      setFields(data.fields || []);
      setPages(data.pages || []);

      // Initialize local values from schema
      const values = {};
      (data.fields || []).forEach(f => {
        values[f.name] = f.value;
      });
      setLocalValues(values);
      setDirtyFields({});
    } catch (err) {
      console.error('Error loading field schema:', err);
      setError('Failed to load PDF field schema.');
    } finally {
      setLoading(false);
    }
  }, [docNumber, sectionId]);

  useEffect(() => {
    loadSchema();
  }, [loadSchema]);

  // Cleanup auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, []);

  const handleFieldChange = (fieldName, value) => {
    setLocalValues(prev => ({ ...prev, [fieldName]: value }));
    setDirtyFields(prev => ({ ...prev, [fieldName]: true }));

    // Trigger auto-save if enabled
    if (autoSave) {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        handleSave({ ...localValues, [fieldName]: value });
      }, 2000);
    }
  };

  const handleSave = async (valuesToSave) => {
    const values = valuesToSave || localValues;
    // Only send dirty fields for efficiency
    const dirtyValues = {};
    Object.keys(dirtyFields).forEach(name => {
      dirtyValues[name] = values[name];
    });

    if (Object.keys(dirtyValues).length === 0 && !valuesToSave) return;

    try {
      setSaving(true);
      setError(null);
      await primusGFSAPI.savePDFFields(sectionId, valuesToSave ? values : dirtyValues);
      setDirtyFields({});
      setSuccessMsg('Fields saved.');
      setTimeout(() => setSuccessMsg(null), 2000);
      onSaved?.();
    } catch (err) {
      console.error('Error saving PDF fields:', err);
      setError('Failed to save field values.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset all field edits back to auto-fill defaults?')) return;
    try {
      setSaving(true);
      setError(null);
      await primusGFSAPI.resetPDFFields(sectionId);
      setDirtyFields({});
      setSuccessMsg('Fields reset to auto-fill defaults.');
      setTimeout(() => setSuccessMsg(null), 2000);
      onSaved?.();
      // Reload schema to get fresh auto-fill values
      await loadSchema();
    } catch (err) {
      console.error('Error resetting PDF fields:', err);
      setError('Failed to reset fields.');
    } finally {
      setSaving(false);
    }
  };

  const togglePageCollapse = (pageNum) => {
    setCollapsedPages(prev => ({ ...prev, [pageNum]: !prev[pageNum] }));
  };

  // Group fields by page
  const fieldsByPage = {};
  fields.forEach(f => {
    if (!fieldsByPage[f.page]) fieldsByPage[f.page] = [];
    fieldsByPage[f.page].push(f);
  });
  const sortedPages = Object.keys(fieldsByPage).map(Number).sort((a, b) => a - b);

  const dirtyCount = Object.keys(dirtyFields).length;
  const totalFields = fields.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 p-4 text-center">
        <Database className="w-12 h-12 mb-3" />
        <p className="text-sm">No form fields found for this document section.</p>
        <p className="text-xs mt-1">This document may not have fillable PDF fields.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
          <Edit3 className="w-3.5 h-3.5" />
          Form Fields
        </h3>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoSave}
              onChange={(e) => setAutoSave(e.target.checked)}
              className="w-3 h-3 rounded text-green-600"
            />
            Auto-save
          </label>
          <button
            onClick={handleReset}
            disabled={saving}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
            title="Reset to auto-fill defaults"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
          <button
            onClick={() => handleSave()}
            disabled={saving || dirtyCount === 0}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Save className="w-3 h-3" />
            )}
            Save
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mx-3 mt-2 flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-400">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}
      {successMsg && (
        <div className="mx-3 mt-2 flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-xs text-green-700 dark:text-green-400">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Scrollable field list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {sortedPages.map(pageNum => {
          const pageFields = fieldsByPage[pageNum];
          const isCollapsed = collapsedPages[pageNum];
          const pageDirtyCount = pageFields.filter(f => dirtyFields[f.name]).length;

          return (
            <div key={pageNum} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {/* Page header */}
              <button
                onClick={() => togglePageCollapse(pageNum)}
                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-750 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                  )}
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Page {pageNum}
                  </span>
                  <span className="text-xs text-gray-400">
                    ({pageFields.length} field{pageFields.length !== 1 ? 's' : ''})
                  </span>
                </div>
                {pageDirtyCount > 0 && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    {pageDirtyCount} unsaved
                  </span>
                )}
              </button>

              {/* Fields */}
              {!isCollapsed && (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {pageFields.map(field => {
                    const isDirty = dirtyFields[field.name];
                    const sourceBadge = SOURCE_BADGES[isDirty ? 'user_override' : field.source] || SOURCE_BADGES.empty;

                    return (
                      <div key={field.name} className="px-3 py-2">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate mr-2">
                            {field.label}
                          </label>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${sourceBadge.color}`}>
                            {isDirty ? 'Edited' : sourceBadge.label}
                          </span>
                        </div>
                        {field.type === 'checkbox' ? (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!localValues[field.name]}
                              onChange={(e) => handleFieldChange(field.name, e.target.checked)}
                              className="w-4 h-4 text-green-600 rounded border-gray-300 dark:border-gray-600"
                            />
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {localValues[field.name] ? 'Yes' : 'No'}
                            </span>
                          </label>
                        ) : (
                          <input
                            type="text"
                            value={localValues[field.name] ?? ''}
                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                            className={`w-full px-2 py-1 text-sm border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 focus:border-green-500 ${
                              isDirty
                                ? 'border-amber-300 dark:border-amber-600'
                                : 'border-gray-200 dark:border-gray-600'
                            }`}
                            placeholder={field.label}
                          />
                        )}
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {field.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
        <span>{totalFields} fields across {sortedPages.length} page{sortedPages.length !== 1 ? 's' : ''}</span>
        {dirtyCount > 0 && (
          <span className="text-amber-600 dark:text-amber-400 font-medium">
            {dirtyCount} unsaved change{dirtyCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
};

export default PDFFieldEditor;
