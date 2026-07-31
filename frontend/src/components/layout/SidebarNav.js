import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  FlaskConical,
  Activity,
  Users,
  Building2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { KeyRound } from 'lucide-react';
import { VIEW_TO_PATH } from '../../routes';
import { getHiddenModules } from '../settings/ModuleVisibilitySettings';
import { useAuth } from '../../contexts/AuthContext';

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
      { id: 'rentals', label: 'Rental Income', icon: KeyRound, permission: 'view_rentals' },
      { id: 'applications', label: 'Applications', icon: FlaskConical },
      { id: 'water', label: 'Water Management', icon: Droplets },
    ],
  },
  {
    id: 'production',
    label: 'Production',
    items: [
      { id: 'harvests', label: 'Harvest & Packing', icon: Wheat },
    ],
  },
  {
    id: 'compliance',
    label: 'Compliance & Safety',
    items: [
      {
        id: 'compliance',
        label: 'Compliance Hub',
        icon: Shield,
        children: [
          { id: 'compliance-pesticide', label: 'Pesticide' },
          { id: 'compliance-wps', label: 'WPS' },
          { id: 'compliance-deadlines', label: 'Deadlines' },
          { id: 'compliance-licenses', label: 'Licenses' },
          { id: 'compliance-inspector-checklist', label: 'Inspector Checklist' },
          { id: 'compliance-reports', label: 'Reports' },
          { id: 'compliance-settings', label: 'Settings' },
        ],
      },
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

const ALWAYS_VISIBLE = new Set(['dashboard', 'company']);

const STORAGE_KEY = 'gm-sidebar-groups';
const EXPANDED_KEY = 'gm-sidebar-expanded';

function getInitialGroupState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return {};
}

function getInitialExpandedState() {
  try {
    const saved = localStorage.getItem(EXPANDED_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return {};
}

function NavItem({ item, collapsed, onMobileClose, expandedItems, toggleItem, isAutoExpanded }) {
  const hasChildren = Array.isArray(item.children) && item.children.length > 0;
  const path = VIEW_TO_PATH[item.id];
  const isExpanded = expandedItems[item.id] ?? isAutoExpanded;

  const rowBase =
    'flex items-center gap-3 px-3 h-10 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-white/50';

  if (!hasChildren) {
    return (
      <NavLink
        to={path}
        end={item.id === 'dashboard' || item.id === 'compliance'}
        onClick={onMobileClose}
        className={({ isActive }) =>
          `${rowBase} ${
            isActive
              ? 'bg-sidebar-active text-white border-l-[3px] border-white/60'
              : 'text-gray-300 hover:bg-sidebar-hover hover:text-white'
          } ${collapsed ? 'justify-center px-0' : ''}`
        }
        title={collapsed ? item.label : undefined}
      >
        <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
        {!collapsed && <span className="text-sm font-medium truncate">{item.label}</span>}
      </NavLink>
    );
  }

  return (
    <div>
      <div className="flex items-stretch">
        <NavLink
          to={path}
          end
          onClick={onMobileClose}
          className={({ isActive }) =>
            `${rowBase} flex-1 ${
              isActive
                ? 'bg-sidebar-active text-white border-l-[3px] border-white/60'
                : 'text-gray-300 hover:bg-sidebar-hover hover:text-white'
            } ${collapsed ? 'justify-center px-0' : ''}`
          }
          title={collapsed ? item.label : undefined}
        >
          <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium truncate">{item.label}</span>}
        </NavLink>
        {!collapsed && (
          <button
            type="button"
            onClick={() => toggleItem(item.id)}
            className="px-2 text-gray-400 hover:text-white hover:bg-sidebar-hover rounded-md focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-expanded={isExpanded}
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${item.label}`}
          >
            <ChevronRight
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
          </button>
        )}
      </div>

      {!collapsed && isExpanded && (
        <div className="mt-1 ml-6 pl-3 border-l border-white/10 space-y-0.5">
          {item.children.map((child) => (
            <NavLink
              key={child.id}
              to={VIEW_TO_PATH[child.id]}
              onClick={onMobileClose}
              className={({ isActive }) =>
                `block px-3 h-8 leading-8 rounded-md text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 truncate ${
                  isActive
                    ? 'bg-sidebar-active text-white'
                    : 'text-gray-400 hover:bg-sidebar-hover hover:text-white'
                }`
              }
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SidebarNav({ collapsed, onMobileClose }) {
  const [collapsedGroups, setCollapsedGroups] = useState(getInitialGroupState);
  const [expandedItems, setExpandedItems] = useState(getInitialExpandedState);
  const [hiddenModules, setHiddenModules] = useState(() => getHiddenModules());
  const { hasPermission } = useAuth();
  const location = useLocation();

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsedGroups));
  }, [collapsedGroups]);

  useEffect(() => {
    localStorage.setItem(EXPANDED_KEY, JSON.stringify(expandedItems));
  }, [expandedItems]);

  useEffect(() => {
    const handler = () => setHiddenModules(getHiddenModules());
    window.addEventListener('gm-module-visibility-changed', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('gm-module-visibility-changed', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const visibleGroups = useMemo(() => {
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          // An item may declare a required permission; most don't.
          (!item.permission || hasPermission(item.permission)) &&
          (ALWAYS_VISIBLE.has(item.id) || !hiddenModules.has(item.id))
      ),
    })).filter((group) => group.items.length > 0);
  }, [hiddenModules, hasPermission]);

  const toggleGroup = (groupId) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const toggleItem = (itemId) => {
    setExpandedItems((prev) => ({ ...prev, [itemId]: !(prev[itemId] ?? isOnDescendant(itemId)) }));
  };

  const isOnDescendant = (itemId) => {
    const parentPath = VIEW_TO_PATH[itemId];
    if (!parentPath) return false;
    return location.pathname.startsWith(parentPath + '/');
  };

  return (
    <nav className="flex-1 py-3 px-3 space-y-5 overflow-y-auto">
      {visibleGroups.map((group) => {
        const isCollapsed = collapsedGroups[group.id];

        return (
          <div key={group.id}>
            {group.label && !collapsed && (
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between px-3 mb-1 group rounded focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-expanded={!isCollapsed}
                aria-label={`${group.label} section`}
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

            {(!group.label || !isCollapsed) && (
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavItem
                    key={item.id}
                    item={item}
                    collapsed={collapsed}
                    onMobileClose={onMobileClose}
                    expandedItems={expandedItems}
                    toggleItem={toggleItem}
                    isAutoExpanded={isOnDescendant(item.id)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
