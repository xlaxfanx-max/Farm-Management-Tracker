import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import Spinner from './Spinner';
import EmptyState from './EmptyState';

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
    if (sort.key !== colKey) return <ChevronsUpDown className="w-3.5 h-3.5 text-gray-400" />;
    return sort.dir === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
    );
  };

  return (
    <div className={`overflow-x-auto ${className}`}>
      {/* Desktop table */}
      <table className="w-full hidden md:table">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-700/50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${
                  col.align === 'right' ? 'text-right' : 'text-left'
                } ${col.sortable !== false ? 'cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200' : ''}`}
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
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {sortedData.map((row, idx) => (
            <tr
              key={row[keyField] || idx}
              className={`
                bg-white dark:bg-gray-800
                ${onRowClick ? 'cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}
                transition-colors
              `}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-4 py-3 text-sm text-gray-900 dark:text-gray-100 ${
                    col.align === 'right' ? 'text-right' : 'text-left'
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
              bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4
              ${onRowClick ? 'cursor-pointer hover:shadow-md active:bg-gray-50 dark:active:bg-gray-700' : ''}
              transition-all
            `}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            {columns.map((col) => (
              <div key={col.key} className="flex justify-between items-center py-1">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  {col.label}
                </span>
                <span className="text-sm text-gray-900 dark:text-gray-100 text-right">
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
