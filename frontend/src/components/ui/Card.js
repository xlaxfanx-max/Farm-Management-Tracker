import React from 'react';

const elevations = {
  flat: 'shadow-none',
  raised: 'shadow-sm',
  floating: 'shadow-lg',
};

const paddings = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

/**
 * The standard surface for grouped content: warm white, 12px radius,
 * one sand hairline, low warm shadow. `accent` adds a Valencia-orange top rule.
 */
export default function Card({
  children,
  elevation = 'raised',
  padding = 'md',
  accent = false,
  className = '',
  as: Tag = 'div',
  ...props
}) {
  return (
    <Tag
      className={`
        bg-surface-raised rounded-card border border-border overflow-hidden
        ${elevations[elevation] ?? elevations.raised}
        ${paddings[padding] ?? paddings.md}
        ${accent ? 'border-t-[3px] border-t-primary' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </Tag>
  );
}

/**
 * Card heading row — serif title, optional eyebrow/description, action slot.
 * `flush` matches a `padding="none"` Card (used above flush tables).
 */
export function CardHeader({
  title,
  eyebrow,
  description,
  action,
  icon: Icon,
  flush = false,
  border = false,
  className = '',
  children,
}) {
  return (
    <div
      className={`
        flex items-start justify-between gap-4
        ${flush ? 'px-6 py-5' : 'mb-5'}
        ${border ? 'border-b border-border' : ''}
        ${className}
      `}
    >
      <div className="min-w-0">
        {eyebrow && <p className="finch-eyebrow mb-1.5">{eyebrow}</p>}
        {title && (
          <h3 className="flex items-center gap-2.5 font-display text-card-title text-heading">
            {Icon && <Icon className="w-5 h-5 text-primary flex-shrink-0" />}
            {title}
          </h3>
        )}
        {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
        {children}
      </div>
      {action && <div className="flex items-center gap-2 flex-shrink-0">{action}</div>}
    </div>
  );
}
