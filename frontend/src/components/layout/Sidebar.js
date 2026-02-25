import React from 'react';
import SidebarHeader from './SidebarHeader';
import SidebarNav from './SidebarNav';
import SidebarUser from './SidebarUser';

export default function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
  isDarkMode,
  onToggleTheme,
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
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`
          ${collapsed ? 'w-16' : 'w-[260px]'}
          bg-sidebar dark:bg-gray-900 transition-all duration-300
          fixed lg:sticky top-0 h-screen z-50
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
        `}
      >
        <div className="flex flex-col h-full">
          <SidebarHeader
            collapsed={collapsed}
            onToggleCollapse={onToggleCollapse}
            isDarkMode={isDarkMode}
            onToggleTheme={onToggleTheme}
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
