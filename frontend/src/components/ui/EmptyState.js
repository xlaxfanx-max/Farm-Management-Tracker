import React from 'react';
import { Inbox } from 'lucide-react';
import Button from './Button';

export default function EmptyState({
  icon: Icon = Inbox,
  title = 'No data yet',
  message,
  actionLabel,
  onAction,
  actionIcon,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 text-center ${className}`}>
      <div className="p-3 bg-surface-sunken rounded-full mb-4">
        <Icon className="w-8 h-8 text-bark-400" />
      </div>
      <h3 className="font-display text-card-title text-heading mb-1">
        {title}
      </h3>
      {message && (
        <p className="text-sm text-text-secondary max-w-sm mb-4">
          {message}
        </p>
      )}
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" icon={actionIcon} onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
