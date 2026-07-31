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
    <div className={`border border-border rounded-card overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="
          w-full flex items-center justify-between px-4 py-3
          bg-surface-sunken
          text-sm font-semibold text-text-secondary
          hover:text-text
          transition-colors
        "
      >
        <span>{title}</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <div className="px-4 py-4 space-y-4 bg-surface-raised border-t border-border">
          {children}
        </div>
      )}
    </div>
  );
}

export default CollapsibleSection;
