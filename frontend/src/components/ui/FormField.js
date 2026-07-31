import React from 'react';

export default function FormField({
  label,
  htmlFor,
  error,
  hint,
  required = false,
  children,
  className = '',
}) {
  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="block text-sm font-semibold text-bark-700 mb-1.5"
        >
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error && <p className="mt-1.5 text-sm text-danger">{error}</p>}
      {hint && !error && (
        <p className="mt-1.5 text-sm text-text-secondary">{hint}</p>
      )}
    </div>
  );
}

/**
 * Canonical control class string.
 *
 * DEPRECATED — kept only while the sweep converts raw controls to the
 * Input/Select/Textarea primitives. The end state is zero references and
 * these exports deleted.
 */
export const inputClasses = [
  'w-full px-3 py-2 text-sm rounded-button border border-border-strong',
  'bg-white text-text shadow-inset',
  'placeholder:text-text-muted',
  'focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring',
  'disabled:bg-surface-sunken disabled:cursor-not-allowed',
  'transition-all duration-fast ease-out',
].join(' ');

export const selectClasses = inputClasses;

export const textareaClasses = [inputClasses, 'resize-y'].join(' ');
