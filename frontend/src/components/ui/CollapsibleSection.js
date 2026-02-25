import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * A collapsible section for progressive disclosure in forms/modals.
 * Defaults to collapsed — user expands to see "advanced" fields.
 */
function CollapsibleSection({
  title = 'Advanced Options',
  defaultOpen = false,
  children,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`border border-border dark:border-gray-700 rounded-lg overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="
          w-full flex items-center justify-between px-4 py-3
          bg-surface-sunken dark:bg-gray-800
          text-sm font-medium text-text-secondary dark:text-gray-300
          hover:text-text dark:hover:text-white
          transition-colors
        "
      >
        <span>{title}</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <div className="px-4 py-4 space-y-4 bg-surface-raised dark:bg-gray-800/50">
          {children}
        </div>
      )}
    </div>
  );
}

export default CollapsibleSection;
