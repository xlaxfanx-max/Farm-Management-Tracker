import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Download } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

export default function PURReportPreview({ data, reportId, onMarkSubmitted }) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  if (!data || !data.rows) return null;

  const { rows = [], summary = {}, period_start, period_end } = data;
  const hasWarnings = rows.some((r) => r.warnings && r.warnings.length > 0);

  const handleExportCSV = () => {
    if (!rows.length) return;
    const headers = ['Date', 'Field', 'Product', 'EPA Reg #', 'Rate', 'Unit', 'Acres Treated', 'Applicator', 'License #'];
    const csvRows = rows.map((r) =>
      [
        r.date,
        r.field_name,
        r.product_name,
        r.epa_reg_number || '',
        r.rate || '',
        r.rate_unit || '',
        r.acres_treated || '',
        r.applicator_name || '',
        r.applicator_license || '',
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
    );
    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pur_report_${period_start}_${period_end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleMarkSubmitted = async () => {
    if (!reportId) return;
    setSubmitting(true);
    try {
      await api.post(`/compliance/reports/${reportId}/submit/`, {});
      toast.success('Report marked as submitted.');
      onMarkSubmitted?.();
    } catch {
      toast.error('Failed to mark as submitted.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-4 px-4 py-3 bg-cream-100 border border-sand-200 rounded-card text-sm">
        <span className="font-semibold text-bark-800">
          {rows.length} application{rows.length !== 1 ? 's' : ''} found
        </span>
        <span className="text-text-secondary">
          {period_start} – {period_end}
        </span>
        {summary.total_acres && (
          <span className="text-bark-600">
            {Number(summary.total_acres).toFixed(1)} acres treated
          </span>
        )}
        {hasWarnings && (
          <span className="flex items-center gap-1 text-yellow-700">
            <AlertTriangle className="w-4 h-4" />
            Some rows need attention
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full text-sm">
          <thead className="bg-cream-50 text-xs text-text-secondary uppercase tracking-wide bg-surface-sunken">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Field</th>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-left">EPA Reg #</th>
              <th className="px-3 py-2 text-right">Rate</th>
              <th className="px-3 py-2 text-right">Acres</th>
              <th className="px-3 py-2 text-left">Applicator</th>
              <th className="px-3 py-2 text-left w-8">OK</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, idx) => {
              const hasRowWarning = row.warnings && row.warnings.length > 0;
              return (
                <tr
                  key={idx}
                  className={
                    hasRowWarning
                      ? 'bg-yellow-100'
                      : 'bg-surface-raised hover:bg-cream-50'
                  }
                >
                  <td className="px-3 py-2 text-bark-700 whitespace-nowrap">{row.date}</td>
                  <td className="px-3 py-2 text-bark-700 max-w-[110px] truncate">{row.field_name}</td>
                  <td className="px-3 py-2 text-bark-700 max-w-[140px] truncate">{row.product_name}</td>
                  <td className="px-3 py-2">
                    {row.epa_reg_number ? (
                      <span className="font-mono text-xs text-bark-700">{row.epa_reg_number}</span>
                    ) : (
                      <span className="text-xs text-danger">Missing</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-bark-700 whitespace-nowrap">
                    {row.rate ? `${row.rate} ${row.rate_unit || ''}` : <span className="text-xs text-yellow-500">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right text-bark-700">
                    {row.acres_treated || <span className="text-xs text-yellow-500">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    {row.applicator_name ? (
                      <div>
                        <p className="text-bark-700 truncate max-w-[110px]">{row.applicator_name}</p>
                        {row.applicator_license ? (
                          <p className="text-xs font-mono text-text-muted">{row.applicator_license}</p>
                        ) : (
                          <p className="text-xs text-yellow-500">No license #</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-yellow-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {hasRowWarning ? (
                      <div className="group relative inline-block">
                        <AlertTriangle className="w-4 h-4 text-yellow-500 cursor-help" />
                        <div className="hidden group-hover:block absolute right-0 bottom-6 z-10 w-52 bg-bark-900 text-white text-xs rounded p-2 shadow-lg whitespace-normal">
                          {row.warnings.join('; ')}
                        </div>
                      </div>
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="text-xs text-text-secondary">
          {hasWarnings
            ? 'Fix highlighted rows before submitting to your county.'
            : 'All rows look good — ready for county submission.'}
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-surface-raised border border-border-strong rounded-button hover:bg-cream-50 transition-colors text-bark-700"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          {reportId && (
            <button
              onClick={handleMarkSubmitted}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {submitting ? 'Saving...' : 'Mark as Submitted'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
