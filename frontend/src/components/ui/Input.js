import React from 'react';
import FormField, { inputClasses } from './FormField';

/**
 * Labelled text input. Wraps FormField; `leading`/`trailing` take adornments
 * (an icon element, a unit suffix, a password-reveal IconButton).
 */
export default function Input({
  label,
  hint,
  error,
  required = false,
  id,
  className = '',
  fieldClassName = '',
  leading,
  trailing,
  ...props
}) {
  const inputId = id || props.name;

  const control = (
    <div className={leading || trailing ? 'relative' : ''}>
      {leading && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none flex items-center">
          {leading}
        </span>
      )}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={`
          ${inputClasses}
          ${error ? 'border-danger focus:border-danger focus:ring-danger-bg' : ''}
          ${leading ? 'pl-9' : ''}
          ${trailing ? 'pr-10' : ''}
          ${className}
        `}
        {...props}
      />
      {trailing && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center text-text-muted">
          {trailing}
        </span>
      )}
    </div>
  );

  return (
    <FormField
      label={label}
      htmlFor={inputId}
      hint={hint}
      error={error}
      required={required}
      className={fieldClassName}
    >
      {control}
    </FormField>
  );
}
