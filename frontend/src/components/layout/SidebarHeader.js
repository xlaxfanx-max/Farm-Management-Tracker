import React from 'react';
import { PanelLeft, PanelLeftClose } from 'lucide-react';

export default function SidebarHeader({ collapsed, onToggleCollapse }) {
  return (
    <div className="px-4 py-4 border-b border-cream-50/[0.14]">
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
        <span className={`font-display text-cream-50 leading-none ${collapsed ? 'sr-only' : 'text-2xl'}`}>
          Finch<span className="text-orange-400">.</span>
        </span>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-button text-cream-50/70 hover:bg-cream-50/10 hover:text-cream-50 transition-colors focus:outline-none focus-visible:ring-[3px] focus-visible:ring-cream-50/30"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
