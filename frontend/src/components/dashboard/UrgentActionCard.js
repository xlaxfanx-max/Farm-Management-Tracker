import React from 'react';
import { AlertTriangle, AlertCircle, Info, ArrowRight } from 'lucide-react';

const PRIORITY_STYLES = {
  high: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: AlertTriangle,
    iconColor: 'text-amber-600',
    dot: 'bg-amber-500',
    ctaBg: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  medium: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: AlertCircle,
    iconColor: 'text-blue-600',
    dot: 'bg-blue-500',
    ctaBg: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
  low: {
    bg: 'bg-surface-sunken',
    border: 'border-border',
    icon: Info,
    iconColor: 'text-text-muted',
    dot: 'bg-gray-400',
    ctaBg: 'bg-gray-600 hover:bg-gray-700 text-white',
  },
};

/**
 * A single urgent action row with label + CTA button.
 */
function UrgentActionCard({ priority = 'medium', label, cta, onClick }) {
  const style = PRIORITY_STYLES[priority] || PRIORITY_STYLES.medium;
  const Icon = style.icon;

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg border
        ${style.bg} ${style.border}
      `}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 ${style.iconColor}`} />
      <span className="text-sm text-text flex-1">{label}</span>
      {cta && (
        <button
          onClick={onClick}
          className={`
            inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium
            transition-colors flex-shrink-0
            ${style.ctaBg}
          `}
        >
          {cta}
          <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

export default React.memo(UrgentActionCard);
