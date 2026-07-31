import React from 'react';
import FormField, { textareaClasses } from './FormField';

export default function Textarea({
  label,
  hint,
  error,
  required = false,
  id,
  rows = 3,
  className = '',
  fieldClassName = '',
  ...props
}) {
  const textareaId = id || props.name;

  return (
    <FormField
      label={label}
      htmlFor={textareaId}
      hint={hint}
      error={error}
      required={required}
      className={fieldClassName}
    >
      <textarea
        id={textareaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        className={`
          ${textareaClasses}
          ${error ? 'border-danger focus:border-danger focus:ring-danger-bg' : ''}
          ${className}
        `}
        {...props}
      />
    </FormField>
  );
}
