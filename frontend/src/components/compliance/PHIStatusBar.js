import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Wheat } from 'lucide-react';

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function PHIStatusBar({ phiBlockedFields = [], onNavigate }) {
  const [expanded, setExpanded] = useState(false);

  if (!phiBlockedFields || phiBlockedFields.length === 0) return null;

  return (
    <div className="w-full bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Wheat className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            {phiBlockedFields.length} field{phiBlockedFields.length !== 1 ? 's' : ''} blocked for harvest
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('compliance-fsma-phi');
            }}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline px-2 py-0.5"
          >
            PHI Checks
          </button>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-amber-200 dark:border-amber-700 divide-y divide-amber-100 dark:divide-amber-800/50">
          {phiBlockedFields.map((field, idx) => (
            <div key={idx} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {field.field_name}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{field.product_name}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  Clears {formatDate(field.clear_date)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {field.days_remaining} day{field.days_remaining !== 1 ? 's' : ''} remaining
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
