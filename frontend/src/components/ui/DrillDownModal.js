// =============================================================================
// DRILL-DOWN MODAL COMPONENT
// =============================================================================
// Reusable modal for showing the source records behind any aggregated KPI value.
// Accepts column definitions and data — works with any card type in the app.

import React, { useEffect, useCallback } from 'react';
import { X, FileSearch } from 'lucide-react';
import Badge from './Badge';
import IconButton from './IconButton';
import Alert from './Alert';

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

const statusTones = {
  complete: 'success',
  completed: 'success',
  verified: 'success',
  active: 'success',
  open: 'success',
  paid: 'success',
  in_progress: 'orange',
  pending: 'warning',
  unpaid: 'warning',
  closed: 'neutral',
  cancelled: 'danger',
  overdue: 'danger',
};

const formatStatusValue = (value) => {
  if (!value) return '-';
  const label = String(value).replace(/_/g, ' ');
  const tone = statusTones[String(value).toLowerCase()] || 'neutral';
  return (
    <Badge tone={tone} size="xs" className="capitalize">
      {label}
    </Badge>
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
        className="absolute inset-0 modal-backdrop"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-surface-raised rounded-modal shadow-xl w-full max-w-4xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 p-5 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div className="p-2 bg-orange-50 rounded-button flex-shrink-0">
                <Icon className="w-5 h-5 text-primary" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="font-display text-card-title text-heading truncate">{title}</h2>
              {subtitle && (
                <p className="text-sm text-text-secondary">{subtitle}</p>
              )}
            </div>
          </div>
          <IconButton icon={X} label="Close" variant="ghost" size="sm" onClick={onClose} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                <p className="mt-3 text-sm text-text-secondary">Loading records...</p>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="p-6">
              <Alert tone="danger">{error}</Alert>
            </div>
          )}

          {!loading && !error && data.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-text-muted">
              <FileSearch className="w-10 h-10 mb-3" />
              <p className="text-sm">{emptyMessage}</p>
            </div>
          )}

          {!loading && !error && data.length > 0 && (
            <table className="w-full">
              <thead className="bg-surface-sunken sticky top-0">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`px-4 py-3 text-xs font-semibold uppercase tracking-caps text-text-secondary ${
                        col.align === 'right' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((row, idx) => (
                  <tr
                    key={row.id || idx}
                    className={`${
                      onRowClick
                        ? 'cursor-pointer hover:bg-orange-50'
                        : 'hover:bg-cream-50'
                    } transition-colors`}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 text-sm text-bark-700 ${
                          col.align === 'right' ? 'text-right font-mono tabular-nums' : 'text-left'
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
          <div className="border-t-2 border-border-strong bg-surface-sunken px-4 py-3">
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
                        className={`px-4 py-1 text-sm font-semibold text-bark-800 ${
                          col.align === 'right' ? 'text-right font-mono tabular-nums' : 'text-left'
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
          <div className="px-5 py-3 border-t border-border text-xs font-mono tabular-nums text-text-muted text-right">
            {data.length} {data.length === 1 ? 'record' : 'records'}
          </div>
        )}
      </div>
    </div>
  );
};

export default DrillDownModal;
