import React, { useState } from 'react';
import Sidebar from './Sidebar';
import MobileHeader from './MobileHeader';

export default function AppLayout({
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
    <div className="flex min-h-screen bg-surface">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        user={user}
        currentCompany={currentCompany}
        companies={companies}
        onLogout={onLogout}
        onSwitchCompany={onSwitchCompany}
      />

      <main className="flex-1 overflow-y-auto min-w-0">
        <MobileHeader onOpenSidebar={() => setMobileSidebarOpen(true)} />
        {children}
      </main>
    </div>
  );
}
