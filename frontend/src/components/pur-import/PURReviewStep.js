// =============================================================================
// PUR REVIEW STEP — Review all parsed PUR reports, map farms, toggle selection
// =============================================================================

import React, { useMemo, useCallback } from 'react';
import {
  FileText, CheckCircle, AlertTriangle, ArrowRight,
} from 'lucide-react';
import PURReviewCard from './PURReviewCard';

export default function PURReviewStep({ reports, farms, filename, onReportsChange, onComplete }) {
  // Stats
  const stats = useMemo(() => {
    const selected = reports.filter(r => r._selected);
    const mapped = selected.filter(r => r._farmId);
    const unmapped = selected.filter(r => !r._farmId);
    const totalProducts = selected.reduce((sum, r) => sum + (r.products || []).length, 0);
    return {
      total: reports.length,
      selected: selected.length,
      mapped: mapped.length,
      unmapped: unmapped.length,
      totalProducts,
    };
  }, [reports]);

  const canProceed = stats.selected > 0 && stats.unmapped === 0;

  const handleReportChange = useCallback((index, updatedReport) => {
    const next = [...reports];
    next[index] = updatedReport;
    onReportsChange(next);
  }, [reports, onReportsChange]);

  const handleSelectAll = useCallback(() => {
    const allSelected = reports.every(r => r._selected);
    onReportsChange(reports.map(r => ({ ...r, _selected: !allSelected })));
  }, [reports, onReportsChange]);

  const handleProceed = useCallback(() => {
    // Only pass selected reports with farm mapping
    const selected = reports.filter(r => r._selected && r._farmId);
    // Map _farmId to the confirm payload shape
    const mapped = selected.map(r => ({
      ...r,
      _farm_id: r._farmId,
      _save_site_mapping: r._rememberMapping || false,
    }));
    onComplete(mapped);
  }, [reports, onComplete]);

  return (
    <div className="p-6 space-y-6">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Review Parsed Reports
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {filename} — {stats.total} report{stats.total !== 1 ? 's' : ''} found
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <button
            onClick={handleSelectAll}
            className="text-blue-600 hover:text-blue-800"
          >
            {reports.every(r => r._selected) ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
          <FileText className="w-4 h-4" />
          {stats.selected} selected
        </span>
        {stats.mapped > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm">
            <CheckCircle className="w-4 h-4" />
            {stats.mapped} mapped to farms
          </span>
        )}
        {stats.unmapped > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-sm">
            <AlertTriangle className="w-4 h-4" />
            {stats.unmapped} need farm mapping
          </span>
        )}
      </div>

      {/* Report cards */}
      <div className="space-y-4">
        {reports.map((report, idx) => (
          <PURReviewCard
            key={report._index ?? idx}
            report={report}
            index={idx}
            farms={farms}
            onChange={(updated) => handleReportChange(idx, updated)}
          />
        ))}
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-500">
          {stats.selected} report{stats.selected !== 1 ? 's' : ''} with {stats.totalProducts} total products will be imported
        </p>
        <button
          onClick={handleProceed}
          disabled={!canProceed}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          Continue to Confirm
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Warning if unmapped */}
      {stats.unmapped > 0 && stats.selected > 0 && (
        <p className="text-sm text-amber-600">
          All selected reports must be mapped to a farm before importing.
        </p>
      )}
    </div>
  );
}
