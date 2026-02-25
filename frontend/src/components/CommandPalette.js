import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
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
  User,
  ArrowRight,
} from 'lucide-react';
import { VIEW_TO_PATH } from '../routes';
import { useData } from '../contexts/DataContext';

// All navigable items
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, keywords: ['home', 'overview'] },
  { id: 'farms', label: 'Farms & Fields', icon: HomeIcon, keywords: ['field', 'ranch', 'grove'] },
  { id: 'applications', label: 'Applications', icon: FlaskConical, keywords: ['spray', 'pesticide', 'pur', 'tank mix'] },
  { id: 'water', label: 'Water Management', icon: Droplets, keywords: ['well', 'irrigation', 'test', 'source'] },
  { id: 'nutrients', label: 'Nutrients', icon: Leaf, keywords: ['fertilizer', 'nitrogen', 'phosphorus'] },
  { id: 'harvests', label: 'Harvest & Packing', icon: Wheat, keywords: ['pick', 'bins', 'crop', 'packing'] },
  { id: 'yield-forecast', label: 'Yield Forecast', icon: TrendingUp, keywords: ['prediction', 'estimate'] },
  { id: 'tree-detection', label: 'Tree Detection', icon: TreePine, keywords: ['ndvi', 'health', 'survey', 'aerial'] },
  { id: 'compliance', label: 'Compliance Hub', icon: Shield, keywords: ['fsma', 'primusgfs', 'gap', 'license', 'deadline'] },
  { id: 'disease', label: 'Disease Prevention', icon: Bug, keywords: ['hlb', 'acp', 'alert', 'quarantine'] },
  { id: 'weather', label: 'Weather', icon: Cloud, keywords: ['forecast', 'rain', 'temperature'] },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, keywords: ['chart', 'report', 'data'] },
  { id: 'reports', label: 'Reports', icon: FileText, keywords: ['pur', 'export', 'pdf'] },
  { id: 'activity', label: 'Activity Log', icon: Activity, keywords: ['audit', 'history', 'changes'] },
  { id: 'team', label: 'Team', icon: Users, keywords: ['invite', 'member', 'role'] },
  { id: 'company', label: 'Settings', icon: Building2, keywords: ['company', 'config', 'preferences'] },
  { id: 'profile', label: 'Profile', icon: User, keywords: ['account', 'password', 'email'] },
];

function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { farms, fields } = useData();

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Build searchable items: nav + farms + fields
  const allItems = useMemo(() => {
    const items = NAV_ITEMS.map(item => ({
      ...item,
      type: 'navigation',
      path: VIEW_TO_PATH[item.id],
    }));

    // Add farms as searchable items
    (farms || []).forEach(farm => {
      items.push({
        id: `farm-${farm.id}`,
        label: farm.name,
        sublabel: 'Farm',
        icon: HomeIcon,
        type: 'farm',
        path: VIEW_TO_PATH['farms'],
        keywords: [farm.name.toLowerCase()],
      });
    });

    // Add fields as searchable items
    (fields || []).forEach(field => {
      items.push({
        id: `field-${field.id}`,
        label: field.name,
        sublabel: `Field · ${field.total_acres || '?'} ac`,
        icon: Leaf,
        type: 'field',
        path: VIEW_TO_PATH['farms'],
        keywords: [field.name.toLowerCase(), field.field_number?.toLowerCase?.() || ''],
      });
    });

    return items;
  }, [farms, fields]);

  // Filter items by query
  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      // Show nav items only when no query (recent/suggested)
      return NAV_ITEMS.map(item => ({
        ...item,
        type: 'navigation',
        path: VIEW_TO_PATH[item.id],
      }));
    }

    const q = query.toLowerCase().trim();
    return allItems.filter(item => {
      if (item.label.toLowerCase().includes(q)) return true;
      if (item.sublabel?.toLowerCase().includes(q)) return true;
      if (item.keywords?.some(kw => kw.includes(q))) return true;
      return false;
    }).slice(0, 12);
  }, [query, allItems]);

  // Keep selectedIndex in bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = useCallback((item) => {
    setIsOpen(false);
    if (item.path) {
      navigate(item.path);
    }
  }, [navigate]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filteredItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filteredItems[selectedIndex]) {
      e.preventDefault();
      handleSelect(filteredItems[selectedIndex]);
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const selected = list.children[selectedIndex];
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Palette */}
      <div className="relative w-full max-w-lg mx-4 bg-surface-raised dark:bg-gray-800 rounded-xl shadow-2xl border border-border dark:border-gray-700 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border dark:border-gray-700">
          <Search className="w-5 h-5 text-text-muted dark:text-gray-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, farms, fields..."
            className="flex-1 bg-transparent text-text dark:text-white text-sm outline-none placeholder-text-muted dark:placeholder-gray-500"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-text-muted dark:text-gray-500 bg-surface-sunken dark:bg-gray-700 rounded border border-border dark:border-gray-600">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[320px] overflow-y-auto py-2">
          {filteredItems.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-text-muted dark:text-gray-500">No results found</p>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                    ${isSelected
                      ? 'bg-primary-light dark:bg-primary/10 text-primary dark:text-green-400'
                      : 'text-text dark:text-gray-200 hover:bg-surface-sunken dark:hover:bg-gray-700'
                    }
                  `}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-primary dark:text-green-400' : 'text-text-muted dark:text-gray-500'}`} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block">{item.label}</span>
                    {item.sublabel && (
                      <span className="text-xs text-text-muted dark:text-gray-500">{item.sublabel}</span>
                    )}
                  </div>
                  {item.type === 'navigation' && isSelected && (
                    <ArrowRight className="w-3.5 h-3.5 text-text-muted dark:text-gray-500 flex-shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-border dark:border-gray-700 flex items-center gap-4 text-[10px] text-text-muted dark:text-gray-500">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-surface-sunken dark:bg-gray-700 rounded border border-border dark:border-gray-600">↑↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-surface-sunken dark:bg-gray-700 rounded border border-border dark:border-gray-600">↵</kbd>
            open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-surface-sunken dark:bg-gray-700 rounded border border-border dark:border-gray-600">esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
