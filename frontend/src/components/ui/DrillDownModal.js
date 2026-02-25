// =============================================================================
// DRILL-DOWN MODAL COMPONENT
// =============================================================================
// Reusable modal for showing the source records behind any aggregated KPI value.
// Accepts column definitions and data — works with any card type in the app.

import React, { useEffect, useCallback } from 'react';
import { X, AlertCircle, FileSearch } from 'lucide-react';

// =============================================================================
// FORMATTING HELPERS
// =============================================================================

const formatCurrencyValue = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatNumberValue = (value, decimals = 0) => {
  if (value === null || value === undefined || value === '') return '-';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

const formatDateValue = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const statusColors = {
  complete: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  verified: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  open: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  unpaid: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
};

const formatStatusValue = (value) => {
  if (!value) return '-';
  const label = String(value).replace(/_/g, ' ');
  const colorClass = statusColors[String(value).toLowerCase()] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${colorClass}`}>
      {label}
    </span>
  );
};

const formatPercentValue = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  return `${Number(value).toFixed(1)}%`;
};

// =============================================================================
// CELL RENDERER
// =============================================================================

const renderCell = (value, format) => {
  switch (format) {
    case 'currency':
      return formatCurrencyValue(value);
    case 'number':
      return formatNumberValue(value);
    case 'decimal':
      return formatNumberValue(value, 1);
    case 'date':
      return formatDateValue(value);
    case 'status':
      return formatStatusValue(value);
    case 'percent':
      return formatPercentValue(value);
    default:
      return value ?? '-';
  }
};

// =============================================================================
// DRILL-DOWN MODAL
// =============================================================================

const DrillDownModal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  columns = [],
  data = [],
  loading = false,
  error = null,
  onRowClick,
  summaryRow,
  emptyMessage = 'No records found',
}) => {
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-surface-raised dark:bg-gray-800 rounded-modal shadow-xl w-full max-w-4xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border dark:border-gray-700">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div className="p-2 bg-primary-light dark:bg-primary-light rounded-lg flex-shrink-0">
                <Icon className="w-5 h-5 text-primary dark:text-primary" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{title}</h2>
              {subtitle && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-surface-sunken dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Loading records...</p>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="p-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {!loading && !error && data.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
              <FileSearch className="w-10 h-10 mb-3" />
              <p className="text-sm">{emptyMessage}</p>
            </div>
          )}

          {!loading && !error && data.length > 0 && (
            <table className="w-full">
              <thead className="bg-surface-sunken dark:bg-gray-700/50 sticky top-0">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${
                        col.align === 'right' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {data.map((row, idx) => (
                  <tr
                    key={row.id || idx}
                    className={`${
                      onRowClick
                        ? 'cursor-pointer hover:bg-primary-light dark:hover:bg-primary-light'
                        : 'hover:bg-surface-sunken dark:hover:bg-gray-700/50'
                    } transition-colors`}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 text-sm ${
                          col.align === 'right' ? 'text-right' : 'text-left'
                        } ${col.className || ''}`}
                      >
                        {renderCell(row[col.key], col.format)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Summary Row */}
        {summaryRow && !loading && !error && data.length > 0 && (
          <div className="border-t-2 border-border-strong dark:border-gray-600 bg-surface-sunken dark:bg-gray-700/50 px-4 py-3">
            <table className="w-full">
              <tbody>
                <tr>
                  {columns.map((col) => {
                    const val = summaryRow[col.key];
                    // If summary value is a label string (like "Total"), render as plain text
                    const isLabel = typeof val === 'string' && isNaN(Number(val));
                    return (
                      <td
                        key={col.key}
                        className={`px-4 py-1 text-sm font-semibold ${
                          col.align === 'right' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {val !== undefined
                          ? (isLabel ? val : renderCell(val, col.format))
                          : ''}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {!loading && !error && data.length > 0 && (
          <div className="px-5 py-3 border-t border-border dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500 text-right">
            {data.length} {data.length === 1 ? 'record' : 'records'}
          </div>
        )}
      </div>
    </div>
  );
};

export default DrillDownModal;
