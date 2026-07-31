import React from 'react';
import { ChevronDown } from 'lucide-react';
import FormField, { inputClasses } from './FormField';

/**
 * Labelled select. Pass `options` as `[{ value, label, disabled }]` or plain
 * strings; alternatively pass `<option>` children directly.
 */
export default function Select({
  label,
  hint,
  error,
  required = false,
  id,
  options,
  placeholder,
  className = '',
  fieldClassName = '',
  children,
  ...props
}) {
  const selectId = id || props.name;

  const normalized = (options || []).map((opt) =>
    typeof opt === 'object' && opt !== null ? opt : { value: opt, label: String(opt) }
  );

  return (
    <FormField
      label={label}
      htmlFor={selectId}
      hint={hint}
      error={error}
      required={required}
      className={fieldClassName}
    >
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          className={`
            ${inputClasses}
            appearance-none pr-9 bg-white
            ${error ? 'border-danger focus:border-danger focus:ring-danger-bg' : ''}
            ${className}
          `}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {normalized.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
          {children}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
      </div>
    </FormField>
  );
}
