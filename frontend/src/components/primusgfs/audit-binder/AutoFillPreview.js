import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Save,
  Edit3,
} from 'lucide-react';
import { primusGFSAPI } from '../../../services/api';

const AutoFillPreview = ({ sectionId, autoFillSource, existingData, onApplied }) => {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [editingField, setEditingField] = useState(null);

  const loadPreview = useCallback(async () => {
    if (!autoFillSource) return;
    try {
      setLoading(true);
      setError(null);
      const response = await primusGFSAPI.autoFillPreview(sectionId);
      setPreview(response.data);
    } catch (err) {
      console.error('Error loading auto-fill preview:', err);
      setError('Failed to load auto-fill data.');
    } finally {
      setLoading(false);
    }
  }, [sectionId, autoFillSource]);

  useEffect(() => {
    // If we already have saved auto-fill data, show that
    if (existingData?.fields?.length > 0) {
      setPreview(existingData);
    } else {
      loadPreview();
    }
  }, [existingData, loadPreview]);

  const handleApply = async () => {
    try {
      setApplying(true);
      setError(null);
      const response = await primusGFSAPI.applyAutoFill(sectionId, {
        manual_overrides: Object.keys(overrides).length > 0 ? overrides : null,
      });
      onApplied?.(response.data);
    } catch (err) {
      console.error('Error applying auto-fill:', err);
      setError('Failed to apply auto-fill data.');
    } finally {
      setApplying(false);
    }
  };

  const handleOverride = (fieldName, value) => {
    setOverrides(prev => ({ ...prev, [fieldName]: value }));
    setEditingField(null);
  };

  if (!autoFillSource) return null;

  const fields = preview?.fields || [];
  const warnings = preview?.warnings || [];

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-500" />
          Auto-Fill Data
          <span className="text-xs text-gray-400 font-normal">
            Source: {autoFillSource}
          </span>
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={loadPreview}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleApply}
            disabled={applying || loading || fields.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {applying ? 'Saving...' : existingData?.fields?.length > 0 ? 'Update & Save' : 'Apply & Save'}
          </button>
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mb-3 space-y-1">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              {w}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mb-3 flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      ) : fields.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">
          No data found. Add records in the relevant modules to enable auto-fill.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide w-1/3">
                  Field
                </th>
                <th className="text-left py-2 px-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Value
                </th>
                <th className="text-left py-2 px-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide w-32">
                  Source
                </th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, idx) => {
                const isOverridden = overrides[field.name] !== undefined;
                const displayValue = isOverridden ? overrides[field.name] : field.value;
                const isEditing = editingField === field.name;

                return (
                  <tr key={idx} className="border-b border-gray-50 dark:border-gray-750 hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="py-1.5 px-2 text-gray-700 dark:text-gray-300 font-medium">
                      {field.name}
                    </td>
                    <td className="py-1.5 px-2">
                      {isEditing ? (
                        <input
                          type="text"
                          defaultValue={displayValue}
                          autoFocus
                          onBlur={(e) => handleOverride(field.name, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleOverride(field.name, e.target.value);
                            if (e.key === 'Escape') setEditingField(null);
                          }}
                          className="w-full px-2 py-1 text-sm border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                        />
                      ) : (
                        <span className={`text-gray-800 dark:text-gray-200 ${isOverridden ? 'text-blue-600 dark:text-blue-400 font-medium' : ''}`}>
                          {displayValue || <span className="text-gray-300 italic">empty</span>}
                          {isOverridden && (
                            <span className="ml-1 text-xs text-blue-500">(edited)</span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-xs text-gray-400 dark:text-gray-500">
                      {field.source}
                    </td>
                    <td className="py-1.5 px-1">
                      <button
                        onClick={() => setEditingField(field.name)}
                        className="p-1 text-gray-300 hover:text-blue-500 transition-colors"
                        title="Edit value"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {existingData?.fields?.length > 0 && (
        <div className="mt-2 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Auto-fill data saved. Click "Refresh" to pull latest system data.
        </div>
      )}
    </div>
  );
};

export default AutoFillPreview;
