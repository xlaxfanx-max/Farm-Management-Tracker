import React, { useState, useEffect } from 'react';
import {
  Database,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  X,
  Loader2,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { primusGFSAPI } from '../../services/api';

/**
 * PrefillBanner — Reusable "Data Available from Platform" banner.
 *
 * Shows when cross-platform data is available for import into a PrimusGFS module.
 * Fetches prefill data, displays count, and lets user review/select items to import.
 *
 * Props:
 *   module       — prefill module slug (e.g., 'chemical-inventory')
 *   sourceLabel  — human label (e.g., 'Pesticide Records')
 *   onImport     — callback(selectedItems) — parent handles the actual CRUD create
 *   renderItem   — optional render function for each item in review table
 *   params       — optional query params to pass to prefill endpoint
 */
const PrefillBanner = ({ module, sourceLabel, onImport, renderItem, params = {} }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [importing, setImporting] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    loadPrefill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module]);

  const loadPrefill = async () => {
    try {
      setLoading(true);
      const response = await primusGFSAPI.getPrefill(module, params);
      setData(response.data);
    } catch (err) {
      console.error('Error loading prefill:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (index) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (!data?.items) return;
    const importable = data.items
      .map((item, i) => ({ item, i }))
      .filter(({ item }) => !item.already_imported);
    if (selected.size === importable.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(importable.map(({ i }) => i)));
    }
  };

  const handleImport = async () => {
    if (selected.size === 0 || !onImport) return;
    const items = data.items.filter((_, i) => selected.has(i));
    try {
      setImporting(true);
      const result = await onImport(items);
      setImportResult({
        success: true,
        count: result?.count || items.length,
      });
      setSelected(new Set());
      // Refresh prefill data to update already_imported flags
      await loadPrefill();
    } catch (err) {
      setImportResult({
        success: false,
        message: err.message || 'Import failed',
      });
    } finally {
      setImporting(false);
    }
  };

  // Don't show if dismissed, loading, no data, or nothing available
  if (dismissed || loading) return null;
  if (!data || !data.items || data.items.length === 0) return null;

  const newItems = data.items.filter(i => !i.already_imported);
  if (newItems.length === 0) return null;

  const importableInView = data.items.filter(i => !i.already_imported);

  return (
    <div className="mb-4 border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
      {/* Banner Header */}
      <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20">
        <Database className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {newItems.length} record{newItems.length !== 1 ? 's' : ''} available from {sourceLabel}
          </p>
          {data.already_imported > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {data.already_imported} already imported
            </p>
          )}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/60"
        >
          {expanded ? 'Collapse' : 'Review & Import'}
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Import Result Toast */}
      {importResult && (
        <div className={`flex items-center gap-2 px-4 py-2 text-sm ${
          importResult.success
            ? 'bg-primary-light dark:bg-green-900/20 text-primary dark:text-green-400'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
        }`}>
          {importResult.success ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Imported {importResult.count} record{importResult.count !== 1 ? 's' : ''} successfully
            </>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4" />
              {importResult.message}
            </>
          )}
          <button
            onClick={() => setImportResult(null)}
            className="ml-auto text-current opacity-60 hover:opacity-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Expanded Review Table */}
      {expanded && (
        <div className="border-t border-blue-200 dark:border-blue-800">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800/50">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.size === importableInView.length && importableInView.length > 0}
                onChange={selectAll}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Select all ({importableInView.length})
            </label>
            <button
              onClick={handleImport}
              disabled={selected.size === 0 || importing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Import Selected ({selected.size})
            </button>
          </div>

          {/* Items List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
            {data.items.map((item, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 px-4 py-2.5 ${
                  item.already_imported
                    ? 'bg-gray-50 dark:bg-gray-800/30 opacity-60'
                    : selected.has(idx)
                    ? 'bg-blue-50 dark:bg-blue-900/10'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(idx)}
                  onChange={() => toggleSelect(idx)}
                  disabled={item.already_imported}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  {renderItem ? (
                    renderItem(item)
                  ) : (
                    <DefaultItemRenderer item={item} />
                  )}
                </div>
                {item.already_imported && (
                  <span className="inline-flex items-center gap-1 text-xs text-primary dark:text-green-400 flex-shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                    Imported
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Default item renderer for the review table
 */
const DefaultItemRenderer = ({ item }) => {
  // Chemical inventory items
  if (item.product_name) {
    return (
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {item.product_name}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {item.manufacturer && `${item.manufacturer} · `}
          {item.epa_registration_number && `EPA: ${item.epa_registration_number} · `}
          {item.chemical_type}
          {item.application_count > 0 && ` · ${item.application_count} application(s)`}
        </p>
      </div>
    );
  }

  // Training / employee items
  if (item.employee_name) {
    return (
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {item.employee_name}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {item.source}
          {item.training_type && ` · ${item.training_type}`}
          {item.training_date && ` · Trained: ${new Date(item.training_date).toLocaleDateString()}`}
        </p>
      </div>
    );
  }

  // Supplier items
  if (item.supplier_name) {
    return (
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {item.supplier_name}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {item.source}
          {item.product_count > 0 && ` · ${item.product_count} product(s)`}
          {item.contact_name && ` · ${item.contact_name}`}
        </p>
      </div>
    );
  }

  // Incident / non-conformance items
  if (item.title) {
    return (
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {item.title}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {item.incident_type && `${item.incident_type} · `}
          {item.severity && `${item.severity} · `}
          {item.incident_date && new Date(item.incident_date).toLocaleDateString()}
        </p>
      </div>
    );
  }

  // Fallback
  return (
    <p className="text-sm text-gray-700 dark:text-gray-300">
      {JSON.stringify(item).substring(0, 100)}
    </p>
  );
};

export default PrefillBanner;
