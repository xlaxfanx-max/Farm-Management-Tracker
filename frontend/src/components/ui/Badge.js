import React from 'react';

// Finch tones. `soft` is the default wash; `solid` is for emphasis.
const tones = {
  neutral: { soft: 'bg-cream-100 text-bark-600', solid: 'bg-bark-700 text-white' },
  orange:  { soft: 'bg-orange-100 text-orange-700', solid: 'bg-orange-500 text-white' },
  green:   { soft: 'bg-green-100 text-green-700', solid: 'bg-green-600 text-white' },
  yellow:  { soft: 'bg-yellow-200 text-yellow-600', solid: 'bg-yellow-500 text-bark-900' },
  success: { soft: 'bg-success-bg text-green-700', solid: 'bg-success text-white' },
  warning: { soft: 'bg-warning-bg text-yellow-600', solid: 'bg-warning text-bark-900' },
  danger:  { soft: 'bg-danger-bg text-danger', solid: 'bg-danger text-white' },
  info:    { soft: 'bg-info-bg text-green-700', solid: 'bg-info text-white' },
};

// Legacy `color` prop → Finch tone. Keeps existing call sites working.
const colorToTone = {
  primary: 'orange',
  orange: 'orange',
  green: 'green',
  red: 'danger',
  amber: 'warning',
  yellow: 'warning',
  blue: 'info',
  purple: 'neutral',
  gray: 'neutral',
  neutral: 'neutral',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
};

const dotColors = {
  neutral: 'bg-bark-400',
  orange: 'bg-orange-500',
  green: 'bg-green-600',
  yellow: 'bg-yellow-500',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
};

const sizeMap = {
  xs: 'px-2 py-0.5 text-xs',
  sm: 'px-2.5 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
};

export default function Badge({
  children,
  color,
  tone,
  variant = 'soft',
  size = 'sm',
  dot = false,
  className = '',
  ...props
}) {
  const resolved = tone || colorToTone[color] || 'neutral';
  const toneSet = tones[resolved] || tones.neutral;

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 font-semibold tracking-[0.02em] rounded-pill whitespace-nowrap
        ${toneSet[variant] || toneSet.soft}
        ${sizeMap[size] || sizeMap.sm}
        ${className}
      `}
      {...props}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            variant === 'solid' ? 'bg-current opacity-70' : dotColors[resolved] || dotColors.neutral
          }`}
        />
      )}
      {children}
    </span>
  );
}
