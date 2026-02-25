import React from 'react';
import { Loader2 } from 'lucide-react';

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

export default function Spinner({ size = 'md', label, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <Loader2
        className={`animate-spin text-primary dark:text-primary ${sizeClasses[size] || sizeClasses.md}`}
      />
      {label && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      )}
    </div>
  );
}

export function PageSpinner({ label = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Spinner size="lg" label={label} />
    </div>
  );
}
