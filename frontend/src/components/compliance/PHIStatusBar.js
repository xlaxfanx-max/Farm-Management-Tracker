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
    <div className="w-full bg-amber-50 border border-amber-300 rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Wheat className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="text-sm font-semibold text-amber-800">
            {phiBlockedFields.length} field{phiBlockedFields.length !== 1 ? 's' : ''} blocked for harvest
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('harvests');
            }}
            className="text-xs font-medium text-blue-600 hover:underline px-2 py-0.5"
          >
            View Harvests
          </button>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-amber-600" />
          ) : (
            <ChevronDown className="w-4 h-4 text-amber-600" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-amber-200 divide-y divide-amber-100">
          {phiBlockedFields.map((field, idx) => (
            <div key={idx} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {field.field_name}
                </p>
                <p className="text-xs text-gray-600">{field.product_name}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-medium text-amber-700">
                  Clears {formatDate(field.clear_date)}
                </p>
                <p className="text-xs text-gray-500">
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
