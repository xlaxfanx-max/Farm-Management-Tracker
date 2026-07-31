import React from 'react';
import { Check, Minus } from 'lucide-react';

/**
 * Checkbox with a real (visually hidden) input so labels, focus and
 * keyboard behaviour stay native.
 */
export default function Checkbox({
  label,
  description,
  checked,
  indeterminate = false,
  disabled = false,
  onChange,
  id,
  className = '',
  ...props
}) {
  const inputId = id || props.name;

  return (
    <label
      htmlFor={inputId}
      className={`inline-flex items-start gap-2.5 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${className}`}
    >
      <span className="relative flex items-center justify-center flex-shrink-0 mt-px">
        <input
          type="checkbox"
          id={inputId}
          checked={indeterminate ? false : !!checked}
          disabled={disabled}
          onChange={onChange}
          className="peer sr-only"
          {...props}
        />
        <span
          className={`
            w-[18px] h-[18px] rounded-[5px] border transition duration-fast ease-out
            flex items-center justify-center
            peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring
            ${checked || indeterminate
              ? 'bg-primary border-primary text-white'
              : 'bg-surface-raised border-border-strong'}
          `}
        >
          {indeterminate ? (
            <Minus className="w-3 h-3" strokeWidth={3} />
          ) : checked ? (
            <Check className="w-3 h-3" strokeWidth={3} />
          ) : null}
        </span>
      </span>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm text-text">{label}</span>}
          {description && <span className="block text-xs text-text-secondary mt-0.5">{description}</span>}
        </span>
      )}
    </label>
  );
}
