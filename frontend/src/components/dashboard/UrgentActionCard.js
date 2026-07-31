import React from 'react';
import { AlertTriangle, AlertCircle, Info, ArrowRight } from 'lucide-react';

const PRIORITY_STYLES = {
  high: {
    bg: 'bg-yellow-100',
    border: 'border-yellow-200',
    icon: AlertTriangle,
    iconColor: 'text-yellow-600',
    dot: 'bg-yellow-500',
    ctaBg: 'bg-yellow-600 hover:bg-yellow-700 text-white',
  },
  medium: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    icon: AlertCircle,
    iconColor: 'text-link',
    dot: 'bg-primary',
    ctaBg: 'bg-primary hover:bg-primary-hover text-white',
  },
  low: {
    bg: 'bg-surface-sunken',
    border: 'border-border',
    icon: Info,
    iconColor: 'text-text-muted',
    dot: 'bg-bark-400',
    ctaBg: 'bg-bark-600 hover:bg-bark-700 text-white',
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
        <button aria-label="Forward"
          onClick={onClick}
          className={`
            inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium
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
