import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { VIEW_NAMES, PARENT_VIEWS } from '../../routes';

/**
 * Breadcrumb navigation component
 */
function Breadcrumbs({ currentView, onNavigate }) {
  // Build breadcrumb trail
  const getBreadcrumbs = () => {
    const crumbs = [];

    if (currentView !== 'dashboard') {
      crumbs.push({
        id: 'dashboard',
        label: 'Dashboard',
        isLink: true
      });
    }

    // Walk up parent chain
    const parentChain = [];
    let current = currentView;
    while (PARENT_VIEWS[current]) {
      parentChain.unshift(PARENT_VIEWS[current]);
      current = PARENT_VIEWS[current];
    }

    for (const parentView of parentChain) {
      crumbs.push({
        id: parentView,
        label: VIEW_NAMES[parentView] || parentView,
        isLink: true
      });
    }

    crumbs.push({
      id: currentView,
      label: VIEW_NAMES[currentView] || currentView,
      isLink: false
    });

    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  // Don't show breadcrumbs on dashboard
  if (currentView === 'dashboard') {
    return null;
  }

  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500 mb-4">
      <button
        onClick={() => onNavigate('dashboard')}
        className="p-1 hover:bg-surface-sunken dark:hover:bg-gray-700 rounded transition-colors"
        title="Go to Dashboard"
      >
        <Home className="w-4 h-4" />
      </button>

      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={crumb.id}>
          <ChevronRight className="w-4 h-4 text-gray-300" />
          {crumb.isLink ? (
            <button
              onClick={() => onNavigate(crumb.id)}
              className="hover:text-primary hover:underline transition-colors"
            >
              {crumb.label}
            </button>
          ) : (
            <span className="text-gray-900 font-medium">{crumb.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

export default Breadcrumbs;
