import React from 'react';
import { Loader2 } from 'lucide-react';

const variants = {
  // Valencia orange — the action colour.
  primary:
    'bg-primary text-white border border-primary shadow-sm hover:bg-primary-hover hover:border-primary-hover',
  // Neutral outline — cancel, dismiss, "not now".
  secondary:
    'bg-transparent text-bark-800 border border-border-strong hover:bg-cream-100',
  // Grove green solid — the second-weight affirmative action.
  green:
    'bg-green-700 text-cream-50 border border-green-700 shadow-sm hover:bg-green-600 hover:border-green-600',
  ghost:
    'bg-transparent text-orange-600 border border-transparent hover:bg-orange-50',
  danger:
    'bg-danger text-white border border-danger shadow-sm hover:bg-danger-hover hover:border-danger-hover',
  link:
    'bg-transparent text-link border border-transparent underline-offset-2 hover:text-link-hover hover:underline',
};

const sizes = {
  sm: 'px-3.5 py-1.5 text-sm gap-1.5',
  md: 'px-5 py-2.5 text-sm gap-2',
  lg: 'px-7 py-3 text-base gap-2.5',
};

const iconSizes = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-[18px] h-[18px]',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon: Icon,
  iconRight: IconRight,
  className = '',
  type = 'button',
  ...props
}) {
  const isDisabled = disabled || loading;
  const iconClass = `${iconSizes[size] || iconSizes.md} flex-shrink-0`;

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center font-semibold leading-none tracking-[0.01em]
        rounded-button transition duration-fast ease-out
        active:translate-y-px
        focus:outline-none focus-visible:outline-none
        focus:ring-[3px] focus:ring-ring
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0
        ${fullWidth ? 'w-full' : ''}
        ${variants[variant] || variants.primary}
        ${sizes[size] || sizes.md}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <Loader2 className={`${iconClass} animate-spin`} />
      ) : Icon ? (
        <Icon className={iconClass} />
      ) : null}
      {children}
      {IconRight && !loading && <IconRight className={iconClass} />}
    </button>
  );
}
