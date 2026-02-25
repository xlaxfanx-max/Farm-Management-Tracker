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
      <div className="p-3 bg-surface-sunken dark:bg-gray-700 rounded-full mb-4">
        <Icon className="w-8 h-8 text-gray-400 dark:text-gray-500" />
      </div>
      <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">
        {title}
      </h3>
      {message && (
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-4">
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
