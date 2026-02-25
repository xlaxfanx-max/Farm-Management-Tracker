import React from 'react';

const colorMap = {
  primary: 'bg-primary-light text-primary dark:bg-primary-light dark:text-primary',
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  gray: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

const sizeMap = {
  xs: 'px-1.5 py-0.5 text-xs',
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

export default function Badge({
  children,
  color = 'gray',
  size = 'sm',
  dot = false,
  className = '',
}) {
  const dotColors = {
    primary: 'bg-primary',
    green: 'bg-green-500',
    red: 'bg-red-500',
    amber: 'bg-amber-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    gray: 'bg-gray-400',
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 font-medium rounded-full
        ${colorMap[color] || colorMap.gray}
        ${sizeMap[size] || sizeMap.sm}
        ${className}
      `}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotColors[color] || dotColors.gray}`} />
      )}
      {children}
    </span>
  );
}
