// =============================================================================
// PUR CONFIRM STEP — Summary + import execution + results display
// =============================================================================

import React, { useState, useCallback, useMemo } from 'react';
import {
  Loader2, CheckCircle, AlertCircle, FileText,
  Package, MapPin, RotateCcw,
} from 'lucide-react';
import { purImportAPI } from '../../services/api';

export default function PURConfirmStep({ reports, farms, filename, onComplete, onReset }) {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // Build summary stats
  const summary = useMemo(() => {
    const totalProducts = reports.reduce((sum, r) => sum + (r.products || []).length, 0);
    const newProducts = reports.reduce((sum, r) => {
      const matches = r._match_info?.product_matches || [];
      return sum + matches.filter(m => m.match_type === 'none').length;
    }, 0);
    const farmNames = {};
    reports.forEach(r => {
      const f = (farms || []).find(f => f.id === r._farmId);
      if (f) farmNames[f.id] = f.name;
    });
    return { total: reports.length, totalProducts, newProducts, farmNames };
  }, [reports, farms]);

  const handleImport = useCallback(async () => {
    setImporting(true);
    setError('');

    try {
      const response = await purImportAPI.confirm({
        filename,
        reports,
      });

      const data = response.data;
      setResult(data);
      onComplete(data);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Import failed';
      setError(msg);
    } finally {
      setImporting(false);
    }
  }, [filename, reports, onComplete]);

  // Post-import success view
  if (result && result.created_events > 0) {
    return (
      <div className="p-8 text-center space-y-6">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
        <div>
          <h2 className="text-xl font-bold text-gray-900">Import Complete</h2>
          <p className="text-gray-500 mt-1">
            Successfully imported {result.created_events} application event{result.created_events !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
          <Stat label="Events" value={result.created_events} />
          <Stat label="New Products" value={result.created_products} />
          <Stat label="New Applicators" value={result.created_applicators} />
        </div>

        {result.errors?.length > 0 && (
          <div className="text-left mx-auto max-w-lg p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm font-medium text-amber-700 mb-1">
              Some reports had issues:
            </p>
            <ul className="text-sm text-amber-600 space-y-1">
              {result.errors.map((e, i) => <li key={i}>- {e}</li>)}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RotateCcw className="w-4 h-4" />
            Import Another
          </button>
        </div>
      </div>
    );
  }

  // Post-import with all errors
  if (result && result.created_events === 0) {
    return (
      <div className="p-8 text-center space-y-6">
        <AlertCircle className="w-16 h-16 text-red-400 mx-auto" />
        <div>
          <h2 className="text-xl font-bold text-gray-900">Import Failed</h2>
          <p className="text-gray-500 mt-1">No events were created.</p>
        </div>

        {result.errors?.length > 0 && (
          <div className="text-left mx-auto max-w-lg p-3 bg-red-50 border border-red-200 rounded-lg">
            <ul className="text-sm text-red-700 space-y-1">
              {result.errors.map((e, i) => <li key={i}>- {e}</li>)}
            </ul>
          </div>
        )}

        <button
          onClick={onReset}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 mx-auto"
        >
          <RotateCcw className="w-4 h-4" />
          Start Over
        </button>
      </div>
    );
  }

  // Pre-import confirmation view
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Confirm Import</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Review the summary below and click Import to save to your records.
        </p>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <FileText className="w-4 h-4 text-gray-400" />
          <span className="font-medium">{filename}</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Reports" value={summary.total} />
          <Stat label="Total Products" value={summary.totalProducts} />
          <Stat label="New Products" value={summary.newProducts} subtitle="will be created" />
          <Stat label="Farms" value={Object.keys(summary.farmNames).length} />
        </div>
      </div>

      {/* Report list */}
      <div className="space-y-2">
        {reports.map((r, idx) => {
          const farmName = summary.farmNames[r._farmId] || 'Unknown';
          return (
            <div
              key={r._index ?? idx}
              className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg text-sm"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-gray-500 text-xs w-6">#{idx + 1}</span>
                <span className="font-medium text-gray-900">
                  PUR {r.pur_number || '-'}
                </span>
                <span className="text-gray-500">{r.date_started}</span>
              </div>
              <div className="flex items-center gap-4 text-gray-600">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {farmName}
                </span>
                <span className="flex items-center gap-1">
                  <Package className="w-3.5 h-3.5" />
                  {(r.products || []).length} products
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Import button */}
      <div className="flex items-center justify-end pt-4 border-t border-gray-200">
        <button
          onClick={handleImport}
          disabled={importing}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {importing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              Import {summary.total} Report{summary.total !== 1 ? 's' : ''}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, subtitle }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
    </div>
  );
}
