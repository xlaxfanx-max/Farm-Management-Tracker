import React from 'react';

export default function Tabs({ tabs, activeTab, onChange, className = '' }) {
  return (
    <div className={`border-b border-border ${className}`}>
      <nav className="flex gap-0 -mb-px overflow-x-auto" role="tablist">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm border-b-2
                whitespace-nowrap transition-colors
                ${
                  isActive
                    ? 'border-primary text-orange-700 font-semibold'
                    : 'border-transparent font-medium text-text-secondary hover:text-text hover:border-border-strong'
                }
              `}
            >
              {Icon && <Icon className="w-4 h-4" />}
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`
                    ml-1 px-1.5 py-0.5 text-xs font-mono tabular-nums rounded-pill
                    ${
                      isActive
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-cream-100 text-bark-600'
                    }
                  `}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
