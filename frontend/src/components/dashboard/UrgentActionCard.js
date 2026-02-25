import React from 'react';
import { AlertTriangle, AlertCircle, Info, ArrowRight } from 'lucide-react';

const PRIORITY_STYLES = {
  high: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    icon: AlertTriangle,
    iconColor: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
    ctaBg: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  medium: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    icon: AlertCircle,
    iconColor: 'text-blue-600 dark:text-blue-400',
    dot: 'bg-blue-500',
    ctaBg: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
  low: {
    bg: 'bg-surface-sunken dark:bg-gray-800',
    border: 'border-border dark:border-gray-700',
    icon: Info,
    iconColor: 'text-text-muted dark:text-gray-400',
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
      <span className="text-sm text-text dark:text-gray-200 flex-1">{label}</span>
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
