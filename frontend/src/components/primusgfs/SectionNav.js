import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  Rocket,
  Leaf,
  Settings,
  Users,
  Truck,
  Scale,
  ChevronDown,
  ChevronRight,
  Shield,
  Phone,
  ListChecks,
  ShieldAlert,
  Map,
  Eye,
  FlaskConical,
  Bug,
  Droplets,
  Wrench,
  Clipboard,
  GraduationCap,
  UserX,
  ClipboardList,
  ClipboardCheck,
  PackageX,
  RotateCcw,
  FileText,
  AlertTriangle,
  ShieldOff,
} from 'lucide-react';

/**
 * Section navigation groups for the PrimusGFS dashboard.
 *
 * Each section has a label, icon, and children (tab items).
 * The `id` on children matches the `activeTab` state in
 * PrimusGFSDashboard so clicking navigates correctly.
 */
const SECTIONS = [
  {
    id: 'overview',
    label: 'What\'s Next',
    icon: LayoutDashboard,
    children: null,
  },
  {
    id: 'cac-manual',
    label: 'CAC Manual',
    icon: BookOpen,
    children: null,
  },
  {
    id: 'getting-started',
    label: 'Getting Started',
    icon: Rocket,
    children: [
      { id: 'profile', label: 'Food Safety Profile', icon: Shield },
      { id: 'org-roles', label: 'Org Roles', icon: Users },
      { id: 'emergency', label: 'Emergency Contacts', icon: Phone },
    ],
  },
  {
    id: 'seasonal',
    label: 'Seasonal Compliance',
    icon: Leaf,
    children: [
      { id: 'pre-season', label: 'Pre-Season Checklist', icon: ListChecks },
      { id: 'field-risk', label: 'Field Risk Assessment', icon: ShieldAlert },
      { id: 'land', label: 'Land History', icon: Map },
      { id: 'perimeter', label: 'Perimeter Monitoring', icon: Eye },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    icon: Settings,
    children: [
      { id: 'chemical-inv', label: 'Chemical Inventory', icon: FlaskConical },
      { id: 'pest-control', label: 'Pest Control', icon: Bug },
      { id: 'sanitation', label: 'Field Sanitation', icon: Droplets },
      { id: 'sanitation-maint', label: 'Sanitation Maint.', icon: Wrench },
      { id: 'calibration', label: 'Equipment Calibration', icon: Wrench },
      { id: 'pre-harvest', label: 'Pre-Harvest Inspection', icon: Clipboard },
    ],
  },
  {
    id: 'people',
    label: 'People & Training',
    icon: Users,
    children: [
      { id: 'training-matrix', label: 'Training Matrix', icon: GraduationCap },
      { id: 'training-sessions', label: 'Training Sessions', icon: BookOpen },
      { id: 'non-conformance', label: 'Non-Conformance', icon: UserX },
      { id: 'committee', label: 'Committee Meetings', icon: ClipboardList },
      { id: 'mgmt-review', label: 'Management Review', icon: ClipboardCheck },
    ],
  },
  {
    id: 'supply-chain',
    label: 'Supply Chain',
    icon: Truck,
    children: [
      { id: 'suppliers', label: 'Suppliers', icon: Truck },
      { id: 'supplier-verify', label: 'Supplier Verification', icon: ClipboardCheck },
      { id: 'product-holds', label: 'Product Holds', icon: PackageX },
      { id: 'recalls', label: 'Mock Recalls', icon: RotateCcw },
    ],
  },
  {
    id: 'governance',
    label: 'Governance',
    icon: Scale,
    children: [
      { id: 'documents', label: 'Documents', icon: FileText },
      { id: 'audits', label: 'Internal Audits', icon: ClipboardCheck },
      { id: 'corrective-actions', label: 'Corrective Actions', icon: AlertTriangle },
      { id: 'food-defense', label: 'Food Defense', icon: ShieldAlert },
      { id: 'food-fraud', label: 'Food Fraud', icon: ShieldOff },
    ],
  },
];

/**
 * Lookup which section group a tab ID belongs to.
 */
const findParentSection = (tabId) => {
  for (const section of SECTIONS) {
    if (section.id === tabId) return section.id;
    if (section.children) {
      for (const child of section.children) {
        if (child.id === tabId) return section.id;
      }
    }
  }
  return null;
};

const STORAGE_KEY = 'primusgfs_nav_expanded';

/**
 * SectionNav — grouped collapsible sidebar navigation for PrimusGFS.
 *
 * Props:
 *   activeTab   - currently selected tab id
 *   onTabChange - callback(tabId) to switch tabs
 *   scores      - optional { [moduleKey]: number } for badges
 */
const SectionNav = ({ activeTab, onTabChange, scores = {} }) => {
  // Initialize expanded state: auto-expand the section containing activeTab
  const [expanded, setExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    // Default: expand section containing activeTab
    const parent = findParentSection(activeTab);
    return parent ? { [parent]: true } : {};
  });

  // Persist expanded state
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(expanded));
    } catch {
      // ignore
    }
  }, [expanded]);

  // Auto-expand section when activeTab changes
  useEffect(() => {
    const parent = findParentSection(activeTab);
    if (parent && !expanded[parent]) {
      setExpanded((prev) => ({ ...prev, [parent]: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const toggleSection = (sectionId) => {
    setExpanded((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  /**
   * Compute average score badge for a section group.
   */
  const getSectionBadge = (section) => {
    if (!section.children || Object.keys(scores).length === 0) return null;
    // Map child tab IDs to score keys (replace - with _)
    const childScores = section.children
      .map((c) => {
        const key = c.id.replace(/-/g, '_');
        return scores[key];
      })
      .filter((s) => s !== undefined && s !== null);
    if (childScores.length === 0) return null;
    const avg = Math.round(childScores.reduce((a, b) => a + b, 0) / childScores.length);
    const color =
      avg >= 80
        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
        : avg >= 60
        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'
        : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400';
    return (
      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${color}`}>
        {avg}%
      </span>
    );
  };

  return (
    <nav className="w-64 flex-shrink-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-y-auto"
         style={{ maxHeight: 'calc(100vh - 200px)' }}>
      <div className="p-2 space-y-0.5">
        {SECTIONS.map((section) => {
          const isTopLevel = section.children === null;
          const isActive = activeTab === section.id;
          const isExpanded = expanded[section.id];
          const SectionIcon = section.icon;

          if (isTopLevel) {
            // Top-level item (Overview, CAC Manual) — clickable, no children
            return (
              <button
                key={section.id}
                onClick={() => onTabChange(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <SectionIcon className="w-4.5 h-4.5 flex-shrink-0" />
                <span className="flex-1 text-left">{section.label}</span>
                {section.id === 'cac-manual' && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 font-medium">
                    PDF
                  </span>
                )}
              </button>
            );
          }

          // Section group — collapsible header + child items
          const hasActiveChild = section.children.some((c) => c.id === activeTab);

          return (
            <div key={section.id}>
              <button
                onClick={() => toggleSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  hasActiveChild
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <SectionIcon className="w-4.5 h-4.5 flex-shrink-0" />
                <span className="flex-1 text-left">{section.label}</span>
                {getSectionBadge(section)}
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                )}
              </button>

              {isExpanded && (
                <div className="ml-3 pl-3 border-l border-gray-200 dark:border-gray-700 space-y-0.5 mt-0.5 mb-1">
                  {section.children.map((child) => {
                    const ChildIcon = child.icon;
                    const childActive = activeTab === child.id;

                    return (
                      <button
                        key={child.id}
                        onClick={() => onTabChange(child.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                          childActive
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-medium'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <ChildIcon className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1 text-left truncate">{child.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
};

export { SECTIONS, findParentSection };
export default SectionNav;
