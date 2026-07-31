import React from 'react';
import SidebarHeader from './SidebarHeader';
import SidebarNav from './SidebarNav';
import SidebarUser from './SidebarUser';

export default function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
  user,
  currentCompany,
  companies,
  onLogout,
  onSwitchCompany,
}) {
  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-bark-900/60 z-40 lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          ${collapsed ? 'w-16' : 'w-[232px]'}
          bg-sidebar transition-all duration-300
          fixed lg:sticky top-0 h-screen z-50
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
        `}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="flex flex-col h-full">
          <SidebarHeader
            collapsed={collapsed}
            onToggleCollapse={onToggleCollapse}
          />

          <SidebarNav
            collapsed={collapsed}
            onMobileClose={onMobileClose}
          />

          <SidebarUser
            user={user}
            currentCompany={currentCompany}
            companies={companies}
            collapsed={collapsed}
            onLogout={onLogout}
            onSwitchCompany={onSwitchCompany}
          />
        </div>
      </aside>
    </>
  );
}
