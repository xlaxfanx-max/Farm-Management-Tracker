import React from 'react';
import { Loader2 } from 'lucide-react';

const variants = {
  primary:
    'bg-primary text-white hover:bg-primary-hover dark:bg-primary dark:hover:bg-primary-hover focus:ring-primary',
  secondary:
    'bg-surface-raised text-gray-700 border border-gray-300 hover:bg-surface-sunken dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 focus:ring-gray-400',
  danger:
    'bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 focus:ring-red-500',
  ghost:
    'text-gray-600 hover:bg-surface-sunken dark:text-gray-300 dark:hover:bg-gray-700 focus:ring-gray-400',
  link:
    'text-primary hover:text-primary-hover dark:text-primary dark:hover:text-primary-hover underline-offset-2 hover:underline focus:ring-primary',
};

const sizes = {
  sm: 'px-3 py-2 text-sm gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
  lg: 'px-5 py-3 text-base gap-2',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  iconRight: IconRight,
  className = '',
  type = 'button',
  ...props
}) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center font-medium rounded-button
        transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2
        dark:focus:ring-offset-gray-800
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant] || variants.primary}
        ${sizes[size] || sizes.md}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : Icon ? (
        <Icon className="w-4 h-4 flex-shrink-0" />
      ) : null}
      {children}
      {IconRight && !loading && <IconRight className="w-4 h-4 flex-shrink-0" />}
    </button>
  );
}
