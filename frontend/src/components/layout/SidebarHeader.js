import React from 'react';
import { Menu, X, Sun, Moon } from 'lucide-react';

export default function SidebarHeader({ collapsed, onToggleCollapse, isDarkMode, onToggleTheme }) {
  return (
    <div className="p-4 border-b border-white/10">
      <div className="flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
              <circle cx="24" cy="24" r="20" fill="#2D5016"/>
              <circle cx="24" cy="26" r="12" fill="#E8791D"/>
              <ellipse cx="24" cy="24" rx="8" ry="10" fill="#F4A934"/>
              <path d="M24 4C24 4 28 10 28 14C28 18 26 20 24 20C22 20 20 18 20 14C20 10 24 4 24 4Z" fill="#4A7A2A"/>
              <path d="M24 4C24 4 20 8 18 10" stroke="#2D5016" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className="font-semibold text-white text-sm tracking-tight">Grove Master</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleTheme}
            className="p-1.5 hover:bg-sidebar-hover rounded transition-colors"
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-gray-300" />}
          </button>
          <button
            onClick={onToggleCollapse}
            className="p-1.5 hover:bg-sidebar-hover rounded transition-colors text-gray-300"
          >
            {collapsed ? <Menu className="w-4 h-4" /> : <X className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
