import React, { useState, useEffect, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
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
  Building2,
  ChevronDown,
} from 'lucide-react';
import { VIEW_TO_PATH } from '../../routes';
import { getHiddenModules } from '../settings/ModuleVisibilitySettings';

const NAV_GROUPS = [
  {
    id: 'top',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { id: 'farms', label: 'Farms & Fields', icon: HomeIcon },
      { id: 'applications', label: 'Applications', icon: FlaskConical },
      { id: 'water', label: 'Water Management', icon: Droplets },
      { id: 'nutrients', label: 'Nutrients', icon: Leaf },
    ],
  },
  {
    id: 'production',
    label: 'Production',
    items: [
      { id: 'harvests', label: 'Harvest & Packing', icon: Wheat },
      { id: 'yield-forecast', label: 'Yield Forecast', icon: TrendingUp },
      { id: 'tree-detection', label: 'Tree Detection', icon: TreePine },
    ],
  },
  {
    id: 'compliance',
    label: 'Compliance & Safety',
    items: [
      { id: 'compliance', label: 'Compliance Hub', icon: Shield },
      { id: 'disease', label: 'Disease Prevention', icon: Bug },
    ],
  },
  {
    id: 'insights',
    label: 'Insights',
    items: [
      { id: 'weather', label: 'Weather', icon: Cloud },
      { id: 'analytics', label: 'Analytics', icon: BarChart3 },
      { id: 'reports', label: 'Reports', icon: FileText },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    items: [
      { id: 'activity', label: 'Activity Log', icon: Activity },
      { id: 'team', label: 'Team', icon: Users },
      { id: 'company', label: 'Settings', icon: Building2 },
    ],
  },
];

// Items that can never be hidden (always in sidebar)
const ALWAYS_VISIBLE = new Set(['dashboard', 'company']);

const STORAGE_KEY = 'gm-sidebar-groups';

function getInitialGroupState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return {};
}

export default function SidebarNav({ collapsed, onMobileClose }) {
  const [collapsedGroups, setCollapsedGroups] = useState(getInitialGroupState);
  const [hiddenModules, setHiddenModules] = useState(() => getHiddenModules());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsedGroups));
  }, [collapsedGroups]);

  // Listen for visibility changes from Settings
  useEffect(() => {
    const handler = () => setHiddenModules(getHiddenModules());
    window.addEventListener('gm-module-visibility-changed', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('gm-module-visibility-changed', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  // Filter groups based on visibility
  const visibleGroups = useMemo(() => {
    return NAV_GROUPS.map(group => ({
      ...group,
      items: group.items.filter(item =>
        ALWAYS_VISIBLE.has(item.id) || !hiddenModules.has(item.id)
      ),
    })).filter(group => group.items.length > 0);
  }, [hiddenModules]);

  const toggleGroup = (groupId) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  return (
    <nav className="flex-1 py-3 px-3 space-y-5 overflow-y-auto">
      {visibleGroups.map((group) => {
        const isCollapsed = collapsedGroups[group.id];

        return (
          <div key={group.id}>
            {/* Group header */}
            {group.label && !collapsed && (
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between px-3 mb-1 group"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-gray-400">
                  {group.label}
                </span>
                <ChevronDown
                  className={`w-3 h-3 text-gray-500 transition-transform ${
                    isCollapsed ? '-rotate-90' : ''
                  }`}
                />
              </button>
            )}

            {/* Group items */}
            {(!group.label || !isCollapsed) && (
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.id}
                    to={VIEW_TO_PATH[item.id]}
                    end={item.id === 'dashboard' || item.id === 'compliance'}
                    onClick={onMobileClose}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 h-10 rounded-md transition-colors ${
                        isActive
                          ? 'bg-sidebar-active text-white border-l-[3px] border-white/60'
                          : 'text-gray-300 hover:bg-sidebar-hover hover:text-white'
                      } ${collapsed ? 'justify-center px-0' : ''}`
                    }
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                    {!collapsed && (
                      <span className="text-sm font-medium truncate">{item.label}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
