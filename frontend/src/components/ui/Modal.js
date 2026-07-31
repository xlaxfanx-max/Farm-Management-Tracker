import React, { useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import IconButton from './IconButton';
import { X } from 'lucide-react';

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-6xl',
};

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  size = 'md',
  children,
  footer,
  className = '',
}) {
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 modal-backdrop transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        className={`
          relative bg-surface-raised rounded-modal shadow-xl
          w-full ${sizeClasses[size] || sizeClasses.md}
          max-h-[90vh] flex flex-col
          ${className}
        `}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3 min-w-0">
              {Icon && (
                <div className="p-2 bg-orange-50 rounded-button flex-shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
              )}
              <div className="min-w-0">
                <h2 id="modal-title" className="font-display text-card-title text-heading truncate">
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-sm text-text-secondary">{subtitle}</p>
                )}
              </div>
            </div>
            <IconButton icon={X} label="Close dialog" variant="ghost" size="sm" onClick={onClose} />
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
