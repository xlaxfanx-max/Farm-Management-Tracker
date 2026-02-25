import React, { useState, useEffect } from 'react';
import {
  Home as HomeIcon,
  Droplets,
  FileText,
  Wheat,
  Leaf,
  Cloud,
  BarChart3,
  Shield,
  Bug,
  TrendingUp,
  TreePine,
  FlaskConical,
  Activity,
  Users,
} from 'lucide-react';

const STORAGE_KEY = 'gm-module-visibility';

// Modules that can be toggled (Dashboard + Settings are always visible)
const TOGGLEABLE_MODULES = [
  { id: 'farms', label: 'Farms & Fields', icon: HomeIcon, group: 'Operations' },
  { id: 'applications', label: 'Applications', icon: FlaskConical, group: 'Operations' },
  { id: 'water', label: 'Water Management', icon: Droplets, group: 'Operations' },
  { id: 'nutrients', label: 'Nutrients', icon: Leaf, group: 'Operations' },
  { id: 'harvests', label: 'Harvest & Packing', icon: Wheat, group: 'Production' },
  { id: 'yield-forecast', label: 'Yield Forecast', icon: TrendingUp, group: 'Production' },
  { id: 'tree-detection', label: 'Tree Detection', icon: TreePine, group: 'Production' },
  { id: 'compliance', label: 'Compliance Hub', icon: Shield, group: 'Compliance' },
  { id: 'disease', label: 'Disease Prevention', icon: Bug, group: 'Compliance' },
  { id: 'weather', label: 'Weather', icon: Cloud, group: 'Insights' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, group: 'Insights' },
  { id: 'reports', label: 'Reports', icon: FileText, group: 'Insights' },
  { id: 'activity', label: 'Activity Log', icon: Activity, group: 'Admin' },
  { id: 'team', label: 'Team', icon: Users, group: 'Admin' },
];

/**
 * Read module visibility from localStorage. Returns a Set of hidden module IDs.
 */
export function getHiddenModules() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return new Set(JSON.parse(saved));
  } catch {}
  return new Set();
}

/**
 * Save hidden module IDs to localStorage.
 */
function saveHiddenModules(hiddenSet) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...hiddenSet]));
}

export default function ModuleVisibilitySettings() {
  const [hidden, setHidden] = useState(() => getHiddenModules());

  const toggle = (moduleId) => {
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      saveHiddenModules(next);
      // Dispatch storage event so SidebarNav picks it up
      window.dispatchEvent(new Event('gm-module-visibility-changed'));
      return next;
    });
  };

  const enableAll = () => {
    setHidden(new Set());
    saveHiddenModules(new Set());
    window.dispatchEvent(new Event('gm-module-visibility-changed'));
  };

  // Group modules
  const groups = {};
  TOGGLEABLE_MODULES.forEach(m => {
    if (!groups[m.group]) groups[m.group] = [];
    groups[m.group].push(m);
  });

  const hiddenCount = hidden.size;

  return (
    <div className="space-y-4">
      {hiddenCount > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-secondary dark:text-gray-400">
            {hiddenCount} module{hiddenCount !== 1 ? 's' : ''} hidden
          </p>
          <button
            onClick={enableAll}
            className="text-sm text-primary hover:text-primary-hover font-medium"
          >
            Show all
          </button>
        </div>
      )}

      {Object.entries(groups).map(([groupName, modules]) => (
        <div key={groupName}>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted dark:text-gray-500 mb-2">
            {groupName}
          </h4>
          <div className="space-y-1">
            {modules.map(mod => {
              const Icon = mod.icon;
              const isVisible = !hidden.has(mod.id);
              return (
                <label
                  key={mod.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-sunken dark:hover:bg-gray-800 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={() => toggle(mod.id)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Icon className="w-4 h-4 text-text-secondary dark:text-gray-400" />
                  <span className={`text-sm ${isVisible ? 'text-text dark:text-gray-200' : 'text-text-muted dark:text-gray-500'}`}>
                    {mod.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
