import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import Spinner from './Spinner';
import EmptyState from './EmptyState';

/**
 * Column shape: { key, label, align, sortable, render, mono }
 * `mono` renders the cell as right-aligned tabular figures.
 */
export default function DataTable({
  columns,
  data = [],
  loading = false,
  emptyTitle = 'No data',
  emptyMessage,
  emptyIcon,
  onRowClick,
  keyField = 'id',
  className = '',
  defaultSort,
}) {
  const [sort, setSort] = useState(defaultSort || { key: null, dir: 'asc' });

  const handleSort = (colKey) => {
    setSort((prev) => {
      if (prev.key === colKey) {
        return { key: colKey, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      }
      return { key: colKey, dir: 'asc' };
    });
  };

  const sortedData = useMemo(() => {
    if (!sort.key) return data;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sort.key];
      const bVal = b[sort.key];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = typeof aVal === 'number' ? aVal - bVal : String(aVal).localeCompare(String(bVal));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [data, sort, columns]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" label="Loading..." />
      </div>
    );
  }

  if (!data.length) {
    return <EmptyState title={emptyTitle} message={emptyMessage} icon={emptyIcon} />;
  }

  const SortIcon = ({ colKey }) => {
    if (sort.key !== colKey) return <ChevronsUpDown className="w-3.5 h-3.5 text-text-muted" />;
    return sort.dir === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 text-primary" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-primary" />
    );
  };

  const cellAlign = (col) => (col.align === 'right' || col.mono ? 'text-right' : 'text-left');

  return (
    <div className={`overflow-x-auto ${className}`}>
      {/* Desktop table */}
      <table className="w-full hidden md:table">
        <thead>
          <tr className="bg-surface-sunken">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-xs font-semibold uppercase tracking-caps text-text-secondary ${cellAlign(col)} ${
                  col.sortable !== false ? 'cursor-pointer select-none hover:text-text' : ''
                }`}
                onClick={col.sortable !== false ? () => handleSort(col.key) : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {col.sortable !== false && <SortIcon colKey={col.key} />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sortedData.map((row, idx) => (
            <tr
              key={row[keyField] || idx}
              className={`
                bg-surface-raised transition-colors
                ${onRowClick ? 'cursor-pointer hover:bg-orange-50' : 'hover:bg-cream-50'}
              `}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-4 py-3 text-sm text-bark-700 ${cellAlign(col)} ${
                    col.mono ? 'font-mono tabular-nums' : ''
                  }`}
                >
                  {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile card layout */}
      <div className="md:hidden space-y-3">
        {sortedData.map((row, idx) => (
          <div
            key={row[keyField] || idx}
            className={`
              bg-surface-raised rounded-card border border-border p-4 transition-all
              ${onRowClick ? 'cursor-pointer hover:shadow-md active:bg-cream-50' : ''}
            `}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            {columns.map((col) => (
              <div key={col.key} className="flex justify-between items-center gap-3 py-1">
                <span className="text-xs font-semibold uppercase tracking-caps text-text-secondary">
                  {col.label}
                </span>
                <span className={`text-sm text-bark-700 text-right ${col.mono ? 'font-mono tabular-nums' : ''}`}>
                  {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '-')}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
