import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';

// Contexts
import { useAuth } from './contexts/AuthContext';
import { PermissionGate } from './contexts/AuthComponents';
import EmptyState from './components/ui/EmptyState';
import { DataProvider } from './contexts/DataContext';
import { ModalProvider } from './contexts/ModalContext';
import { SeasonProvider } from './contexts/SeasonContext';

// Route config
import { VIEW_TO_PATH, PATH_TO_VIEW } from './routes';

// Eagerly loaded (always needed)
import AppLayout from './components/layout/AppLayout';
import Dashboard from './components/Dashboard';
import GlobalModals from './components/GlobalModals';
import CommandPalette from './components/CommandPalette';
import ErrorBoundary from './components/ui/ErrorBoundary';
import PageShell from './components/layout/PageShell';

// Lazy-loaded components (code-split per route)
const CompanySettings = lazy(() => import('./components/CompanySettings'));
const Profile = lazy(() => import('./components/Profile'));
const Farms = lazy(() => import('./components/Farms'));
const WaterManagement = lazy(() => import('./components/water-management'));
const Reports = lazy(() => import('./components/Reports'));
const Harvests = lazy(() => import('./components/harvests'));
const AuditLogViewer = lazy(() => import('./components/AuditLogViewer'));
const TeamManagement = lazy(() => import('./components/TeamManagement'));
const WeatherForecast = lazy(() => import('./components/WeatherForecast'));
const Analytics = lazy(() => import('./components/Analytics'));
const ComplianceDashboard = lazy(() => import('./components/compliance/ComplianceDashboard'));
const DeadlineCalendar = lazy(() => import('./components/compliance/DeadlineCalendar'));
const LicenseManagement = lazy(() => import('./components/compliance/LicenseManagement'));
const WPSCompliance = lazy(() => import('./components/compliance/WPSCompliance'));
const ComplianceReports = lazy(() => import('./components/compliance/ComplianceReports'));
const ComplianceSettings = lazy(() => import('./components/compliance/ComplianceSettings'));
const InspectorChecklist = lazy(() => import('./components/compliance/InspectorChecklist'));
const PURImportPage = lazy(() => import('./components/pur-import/PURImportPage'));
const RentalsDashboard = lazy(() => import('./components/rentals'));

// =============================================================================
// ROUTE LOADING FALLBACK
// =============================================================================

function RouteLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-text-secondary">Loading...</p>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN APP COMPONENT (WRAPPED WITH PROVIDERS)
// =============================================================================

function AppContent() {
  const {
    isAuthenticated,
    loading: authLoading,
    user,
    currentCompany,
    companies,
    logout,
    switchCompany
  } = useAuth();

  const location = useLocation();
  const navigate = useNavigate();
  const currentView = PATH_TO_VIEW[location.pathname] || 'dashboard';

  const handleNavigate = (viewId) => {
    const path = VIEW_TO_PATH[viewId];
    if (path) {
      navigate(path);
    }
  };

  // ============================================================================
  // AUTH HANDLERS
  // ============================================================================
  const handleLogout = async () => {
    await logout();
  };

  const handleSwitchCompany = async (companyId) => {
    await switchCompany(companyId);
  };

  // ============================================================================
  // LOADING STATE
  // ============================================================================
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // LOGIN (Registration is invitation-only via AcceptInvitation)
  // ============================================================================
  if (!isAuthenticated) {
    return null; // Main.jsx handles unauthenticated routing
  }

  // ============================================================================
  // MAIN AUTHENTICATED UI
  // ============================================================================
  // Rentals is gated as a unit. Rent figures and occupant names have no
  // bearing on field work, so field roles do not carry view_rentals at all.
  const rentalsRoute = (tab) => (
    <PermissionGate
      permission="view_rentals"
      fallback={
        <div className="p-6">
          <EmptyState
            title="No access"
            message="Ask an owner for the Rentals permission."
          />
        </div>
      }
    >
      <RentalsDashboard initialTab={tab} onNavigate={handleNavigate} />
    </PermissionGate>
  );

  // Accountants log in to work the chase list, which lives in Harvest &
  // Packing now that pick & haul is rolled into the harvest section.
  const isAccountant = currentCompany?.role_codename === 'accountant';

  return (
    <AppLayout
      user={user}
      currentCompany={currentCompany}
      companies={companies}
      onLogout={handleLogout}
      onSwitchCompany={handleSwitchCompany}
    >
      <ErrorBoundary level="section" name="Page Content" key={currentView}>
        <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
            <Route
              index
              element={
                isAccountant
                  ? <Navigate to="/dashboard/harvests" replace />
                  : <PageShell view="dashboard"><Dashboard onNavigate={handleNavigate} /></PageShell>
              }
            />
            <Route path="farms" element={
              <PageShell view="farms">
                <Farms />
              </PageShell>
            } />
            <Route path="applications" element={
              <PageShell view="applications">
                <PURImportPage onNavigate={handleNavigate} />
              </PageShell>
            } />
            <Route path="pur-import" element={
              <PageShell view="pur-import">
                <PURImportPage onNavigate={handleNavigate} initialStep="upload" />
              </PageShell>
            } />
            <Route path="reports" element={
              <PageShell view="reports">
                <Reports />
              </PageShell>
            } />
            <Route path="harvests" element={
              <PageShell view="harvests">
                <Harvests />
              </PageShell>
            } />
            <Route path="team" element={
              <PageShell view="team">
                <TeamManagement />
              </PageShell>
            } />
            <Route path="company" element={
              <PageShell view="company">
                <CompanySettings onBack={() => handleNavigate('dashboard')} />
              </PageShell>
            } />
            <Route path="profile" element={
              <PageShell view="profile">
                <Profile onBack={() => handleNavigate('dashboard')} />
              </PageShell>
            } />
            <Route path="water" element={
              <PageShell view="water">
                <WaterManagement />
              </PageShell>
            } />
            <Route path="weather" element={
              <PageShell view="weather">
                <WeatherForecast />
              </PageShell>
            } />
            <Route path="analytics" element={
              <PageShell view="analytics">
                <Analytics />
              </PageShell>
            } />
            <Route path="activity" element={
              <PageShell view="activity">
                <AuditLogViewer />
              </PageShell>
            } />
            <Route path="compliance" element={<PageShell view="compliance"><ComplianceDashboard onNavigate={handleNavigate} /></PageShell>} />
            <Route path="compliance/deadlines" element={<PageShell view="compliance-deadlines"><DeadlineCalendar onNavigate={handleNavigate} /></PageShell>} />
            <Route path="compliance/licenses" element={<PageShell view="compliance-licenses"><LicenseManagement onNavigate={handleNavigate} /></PageShell>} />
            <Route path="compliance/wps" element={<PageShell view="compliance-wps"><WPSCompliance onNavigate={handleNavigate} /></PageShell>} />
            <Route path="compliance/reports" element={<PageShell view="compliance-reports"><ComplianceReports onNavigate={handleNavigate} /></PageShell>} />
            <Route path="compliance/settings" element={<PageShell view="compliance-settings"><ComplianceSettings onNavigate={handleNavigate} /></PageShell>} />
            <Route path="compliance/pesticide" element={<PageShell view="compliance-pesticide"><DeadlineCalendar onNavigate={handleNavigate} /></PageShell>} />
            <Route path="compliance/inspector-checklist" element={<PageShell view="compliance-inspector-checklist"><InspectorChecklist onNavigate={handleNavigate} /></PageShell>} />
            {/* Pick & haul rolled into Harvest & Packing; old links land there. */}
            <Route path="pick-haul/*" element={<Navigate to="/dashboard/harvests" replace />} />
            <Route path="rentals" element={<PageShell view="rentals">{rentalsRoute('overview')}</PageShell>} />
            <Route path="rentals/rent-roll" element={<PageShell view="rentals-rent-roll">{rentalsRoute('rent-roll')}</PageShell>} />
            {/* Catch-all redirect to dashboard */}
            <Route path="*" element={<PageShell view="dashboard"><Dashboard onNavigate={handleNavigate} /></PageShell>} />
        </Routes>
        </Suspense>
      </ErrorBoundary>

      {/* Global Modals */}
      <GlobalModals />

      {/* Command Palette (Cmd+K / Ctrl+K) */}
      <CommandPalette />
    </AppLayout>
  );
}

// =============================================================================
// APP WRAPPER WITH PROVIDERS
// =============================================================================

function App() {
  return (
    <ErrorBoundary level="app" name="Finch">
      <SeasonProvider>
        <DataProvider>
          <ModalProvider>
            <AppContent />
          </ModalProvider>
        </DataProvider>
      </SeasonProvider>
    </ErrorBoundary>
  );
}

export default App;
