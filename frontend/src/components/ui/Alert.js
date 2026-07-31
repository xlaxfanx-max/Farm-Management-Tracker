import React from 'react';
import { Info, CheckCircle2, AlertTriangle, AlertOctagon, X } from 'lucide-react';

const tones = {
  info:    { wrap: 'bg-green-50 border-green-200', icon: 'text-info', title: 'text-green-700', defaultIcon: Info },
  success: { wrap: 'bg-success-bg border-green-200', icon: 'text-success', title: 'text-green-700', defaultIcon: CheckCircle2 },
  warning: { wrap: 'bg-warning-bg border-yellow-300', icon: 'text-yellow-600', title: 'text-yellow-700', defaultIcon: AlertTriangle },
  danger:  { wrap: 'bg-danger-bg border-red-200', icon: 'text-danger', title: 'text-danger', defaultIcon: AlertOctagon },
};

/** Inline banner. Replaces the ad-hoc coloured wash notices across the app. */
export default function Alert({
  tone = 'info',
  title,
  children,
  icon,
  onClose,
  action,
  className = '',
}) {
  const t = tones[tone] || tones.info;
  const Icon = icon === null ? null : icon || t.defaultIcon;

  return (
    <div className={`flex items-start gap-3 rounded-card border p-4 ${t.wrap} ${className}`} role="alert">
      {Icon && <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${t.icon}`} />}
      <div className="flex-1 min-w-0">
        {title && <p className={`text-sm font-semibold ${t.title}`}>{title}</p>}
        {children && (
          <div className={`text-sm text-bark-700 ${title ? 'mt-1' : ''}`}>{children}</div>
        )}
        {action && <div className="mt-2.5 flex items-center gap-2">{action}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="flex-shrink-0 -mt-0.5 -mr-1 p-1 rounded-button text-text-secondary hover:text-text hover:bg-black/[0.04] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
