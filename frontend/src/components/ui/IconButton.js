import React from 'react';
import { Loader2 } from 'lucide-react';

const variants = {
  solid: 'bg-primary text-white border border-primary shadow-sm hover:bg-primary-hover',
  outline: 'bg-transparent text-bark-700 border border-border-strong hover:bg-cream-100',
  ghost: 'bg-transparent text-text-secondary border border-transparent hover:bg-cream-100 hover:text-text',
  danger: 'bg-transparent text-danger border border-transparent hover:bg-danger-bg',
};

const sizes = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

const iconSizes = {
  sm: 'w-4 h-4',
  md: 'w-[18px] h-[18px]',
  lg: 'w-5 h-5',
};

/**
 * Square, icon-only button for toolbars and dense controls.
 * `label` is required — it becomes the accessible name.
 */
export default function IconButton({
  icon: Icon,
  label,
  variant = 'ghost',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  ...props
}) {
  const isDisabled = disabled || loading;
  const IconComponent = loading ? Loader2 : Icon;

  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center flex-shrink-0
        rounded-button transition duration-fast ease-out
        active:translate-y-px
        focus:outline-none focus-visible:outline-none focus:ring-[3px] focus:ring-ring
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0
        ${variants[variant] || variants.ghost}
        ${sizes[size] || sizes.md}
        ${className}
      `}
      {...props}
    >
      {IconComponent && (
        <IconComponent className={`${iconSizes[size] || iconSizes.md} ${loading ? 'animate-spin' : ''}`} />
      )}
    </button>
  );
}
