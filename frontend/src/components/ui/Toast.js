import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const typeConfig = {
  success: {
    icon: CheckCircle,
    bg: 'bg-success-bg border-green-200',
    text: 'text-green-700',
    iconColor: 'text-success',
  },
  error: {
    icon: XCircle,
    bg: 'bg-danger-bg border-red-200',
    text: 'text-danger',
    iconColor: 'text-danger',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-warning-bg border-yellow-300',
    text: 'text-yellow-700',
    iconColor: 'text-yellow-600',
  },
  info: {
    icon: Info,
    bg: 'bg-green-50 border-green-200',
    text: 'text-green-700',
    iconColor: 'text-info',
  },
};

export default function Toast({ id, type = 'info', message, duration = 4000, onDismiss }) {
  const config = typeConfig[type] || typeConfig.info;
  const Icon = config.icon;

  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-card border shadow-lg ${config.bg} ${config.text} animate-slide-in min-w-[280px] max-w-md`}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${config.iconColor}`} />
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button
        onClick={() => onDismiss(id)}
        aria-label="Dismiss notification"
        className="flex-shrink-0 p-0.5 rounded hover:bg-black/10 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2">
      {toasts.map((t) => (
        <Toast key={t.id} {...t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
