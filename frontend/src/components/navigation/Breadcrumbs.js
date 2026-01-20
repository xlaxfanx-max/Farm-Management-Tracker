import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

/**
 * Breadcrumb navigation component
 */
function Breadcrumbs({ currentView, onNavigate }) {
  // Map view IDs to display names
  const viewNames = {
    dashboard: 'Dashboard',
    farms: 'Farms & Fields',
    weather: 'Weather',
    analytics: 'Analytics',
    water: 'Water Management',
    nutrients: 'Nutrients',
    harvests: 'Harvests',
    compliance: 'Compliance',
    'compliance-deadlines': 'Deadlines',
    'compliance-licenses': 'Licenses',
    'compliance-wps': 'WPS Compliance',
    'compliance-reports': 'Reports',
    'compliance-settings': 'Settings',
    disease: 'Disease Prevention',
    reports: 'Reports',
    activity: 'Activity Log',
    team: 'Team',
    company: 'Company Settings',
    profile: 'Profile'
  };

  // Parent view mappings for nested views
  const parentViews = {
    'compliance-deadlines': 'compliance',
    'compliance-licenses': 'compliance',
    'compliance-wps': 'compliance',
    'compliance-reports': 'compliance',
    'compliance-settings': 'compliance',
  };

  // Build breadcrumb trail
  const getBreadcrumbs = () => {
    const crumbs = [];

    // Always start with Dashboard
    if (currentView !== 'dashboard') {
      crumbs.push({
        id: 'dashboard',
        label: 'Dashboard',
        isLink: true
      });
    }

    // Add parent view if current view has one
    const parentView = parentViews[currentView];
    if (parentView) {
      crumbs.push({
        id: parentView,
        label: viewNames[parentView] || parentView,
        isLink: true
      });
    }

    // Add current view
    crumbs.push({
      id: currentView,
      label: viewNames[currentView] || currentView,
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
        className="p-1 hover:bg-gray-100 rounded transition-colors"
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
              className="hover:text-gray-700 hover:underline transition-colors"
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
