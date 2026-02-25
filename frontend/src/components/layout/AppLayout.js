import React, { useState } from 'react';
import Sidebar from './Sidebar';
import MobileHeader from './MobileHeader';

export default function AppLayout({
  isDarkMode,
  onToggleTheme,
  user,
  currentCompany,
  companies,
  onLogout,
  onSwitchCompany,
  children,
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-surface dark:bg-gray-900 transition-colors duration-300">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        isDarkMode={isDarkMode}
        onToggleTheme={onToggleTheme}
        user={user}
        currentCompany={currentCompany}
        companies={companies}
        onLogout={onLogout}
        onSwitchCompany={onSwitchCompany}
      />

      <main className="flex-1 overflow-y-auto min-w-0">
        <MobileHeader
          onOpenSidebar={() => setMobileSidebarOpen(true)}
          isDarkMode={isDarkMode}
          onToggleTheme={onToggleTheme}
        />
        {children}
      </main>
    </div>
  );
}
