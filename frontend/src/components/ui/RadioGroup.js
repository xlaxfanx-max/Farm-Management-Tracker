import React from 'react';

/**
 * Radio group. `options` is `[{ value, label, description, disabled }]`
 * or plain strings.
 */
export default function RadioGroup({
  label,
  name,
  value,
  options = [],
  onChange,
  orientation = 'vertical',
  disabled = false,
  className = '',
}) {
  const normalized = options.map((opt) =>
    typeof opt === 'object' && opt !== null ? opt : { value: opt, label: String(opt) }
  );

  return (
    <div className={className} role="radiogroup" aria-label={label}>
      {label && <p className="block text-sm font-semibold text-bark-700 mb-1.5">{label}</p>}
      <div className={orientation === 'horizontal' ? 'flex flex-wrap gap-5' : 'space-y-2.5'}>
        {normalized.map((opt) => {
          const optDisabled = disabled || opt.disabled;
          const isChecked = value === opt.value;
          return (
            <label
              key={opt.value}
              className={`inline-flex items-start gap-2.5 ${
                optDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              <span className="relative flex items-center justify-center flex-shrink-0 mt-px">
                <input
                  type="radio"
                  name={name}
                  value={opt.value}
                  checked={isChecked}
                  disabled={optDisabled}
                  onChange={(e) => onChange && onChange(e.target.value, e)}
                  className="peer sr-only"
                />
                <span
                  className={`
                    w-[18px] h-[18px] rounded-full border transition duration-fast ease-out
                    flex items-center justify-center
                    peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring
                    ${isChecked ? 'border-primary bg-white' : 'border-border-strong bg-white'}
                  `}
                >
                  {isChecked && <span className="w-2 h-2 rounded-full bg-primary" />}
                </span>
              </span>
              <span className="min-w-0">
                <span className="block text-sm text-text">{opt.label}</span>
                {opt.description && (
                  <span className="block text-xs text-text-secondary mt-0.5">{opt.description}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
