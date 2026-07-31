import React from 'react';

/** On/off toggle. Grove green when on, sand when off. */
export default function Switch({
  label,
  description,
  checked = false,
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
      className={`inline-flex items-center gap-3 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${className}`}
    >
      <span className="relative inline-flex flex-shrink-0">
        <input
          type="checkbox"
          role="switch"
          id={inputId}
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          className="peer sr-only"
          {...props}
        />
        <span
          className={`
            w-10 h-[23px] rounded-pill transition-colors duration-fast ease-out
            peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring
            ${checked ? 'bg-green-600' : 'bg-sand-300'}
          `}
        />
        <span
          className={`
            absolute top-[3px] left-[3px] w-[17px] h-[17px] rounded-full bg-white shadow-sm
            transition-transform duration-fast ease-out
            ${checked ? 'translate-x-[17px]' : 'translate-x-0'}
          `}
        />
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
