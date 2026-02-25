import React from 'react';
import { Menu, Sun, Moon } from 'lucide-react';

export default function MobileHeader({ onOpenSidebar, isDarkMode, onToggleTheme }) {
  return (
    <div className="sticky top-0 z-30 lg:hidden bg-surface-raised dark:bg-gray-800 border-b border-border dark:border-gray-700 px-4 py-3 flex items-center gap-3">
      <button
        onClick={onOpenSidebar}
        className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-surface-sunken dark:hover:bg-gray-700 rounded-lg"
      >
        <Menu className="w-5 h-5" />
      </button>
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6">
          <circle cx="24" cy="24" r="20" fill="#2D5016"/>
          <circle cx="24" cy="26" r="12" fill="#E8791D"/>
          <ellipse cx="24" cy="24" rx="8" ry="10" fill="#F4A934"/>
          <path d="M24 4C24 4 28 10 28 14C28 18 26 20 24 20C22 20 20 18 20 14C20 10 24 4 24 4Z" fill="#4A7A2A"/>
        </svg>
        <span className="font-semibold text-gray-900 dark:text-white text-sm">Grove Master</span>
      </div>
      <button
        onClick={onToggleTheme}
        className="ml-auto p-2 text-gray-600 dark:text-gray-300 hover:bg-surface-sunken dark:hover:bg-gray-700 rounded-lg"
      >
        {isDarkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5" />}
      </button>
    </div>
  );
}
