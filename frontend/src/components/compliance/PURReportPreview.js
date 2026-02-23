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
      <div className="flex flex-wrap items-center gap-4 px-4 py-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg text-sm">
        <span className="font-semibold text-purple-800 dark:text-purple-200">
          {rows.length} application{rows.length !== 1 ? 's' : ''} found
        </span>
        <span className="text-gray-500 dark:text-gray-400">
          {period_start} – {period_end}
        </span>
        {summary.total_acres && (
          <span className="text-gray-600 dark:text-gray-300">
            {Number(summary.total_acres).toFixed(1)} acres treated
          </span>
        )}
        {hasWarnings && (
          <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4" />
            Some rows need attention
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
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
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {rows.map((row, idx) => {
              const hasRowWarning = row.warnings && row.warnings.length > 0;
              return (
                <tr
                  key={idx}
                  className={
                    hasRowWarning
                      ? 'bg-amber-50 dark:bg-amber-900/10'
                      : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }
                >
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100 whitespace-nowrap">{row.date}</td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-[110px] truncate">{row.field_name}</td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-[140px] truncate">{row.product_name}</td>
                  <td className="px-3 py-2">
                    {row.epa_reg_number ? (
                      <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{row.epa_reg_number}</span>
                    ) : (
                      <span className="text-xs text-red-500">Missing</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {row.rate ? `${row.rate} ${row.rate_unit || ''}` : <span className="text-xs text-amber-500">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                    {row.acres_treated || <span className="text-xs text-amber-500">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    {row.applicator_name ? (
                      <div>
                        <p className="text-gray-700 dark:text-gray-300 truncate max-w-[110px]">{row.applicator_name}</p>
                        {row.applicator_license ? (
                          <p className="text-xs font-mono text-gray-400 dark:text-gray-500">{row.applicator_license}</p>
                        ) : (
                          <p className="text-xs text-amber-500">No license #</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-amber-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {hasRowWarning ? (
                      <div className="group relative inline-block">
                        <AlertTriangle className="w-4 h-4 text-amber-500 cursor-help" />
                        <div className="hidden group-hover:block absolute right-0 bottom-6 z-10 w-52 bg-gray-900 text-white text-xs rounded p-2 shadow-lg whitespace-normal">
                          {row.warnings.join('; ')}
                        </div>
                      </div>
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
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
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {hasWarnings
            ? 'Fix highlighted rows before submitting to your county.'
            : 'All rows look good — ready for county submission.'}
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          {reportId && (
            <button
              onClick={handleMarkSubmitted}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
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
