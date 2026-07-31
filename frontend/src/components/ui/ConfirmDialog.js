import React from 'react';
import ReactDOM from 'react-dom';
import { AlertTriangle, Trash2 } from 'lucide-react';
import Button from './Button';

const variantConfig = {
  danger: {
    icon: Trash2,
    iconBg: 'bg-danger-bg',
    iconColor: 'text-danger',
    confirmVariant: 'danger',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-warning-bg',
    iconColor: 'text-yellow-600',
    confirmVariant: 'primary',
  },
};

export default function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title = 'Are you sure?',
  message = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
}) {
  if (!isOpen) return null;

  const config = variantConfig[variant] || variantConfig.danger;
  const IconComponent = config.icon;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 modal-backdrop" onClick={loading ? undefined : onCancel} aria-hidden="true" />
      <div className="relative bg-surface-raised rounded-modal shadow-xl max-w-sm w-full p-6" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <div className="flex items-start gap-4">
          <div className={`p-2 rounded-button flex-shrink-0 ${config.iconBg}`}>
            <IconComponent className={`w-5 h-5 ${config.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="confirm-dialog-title" className="font-display text-card-title text-heading">
              {title}
            </h3>
            {message && (
              <p className="mt-2 text-sm text-text-secondary">
                {message}
              </p>
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={config.confirmVariant}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
