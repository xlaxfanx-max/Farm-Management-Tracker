import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';

// Contexts
import { useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { ModalProvider } from './contexts/ModalContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { SeasonProvider } from './contexts/SeasonContext';

// Route config
import { VIEW_TO_PATH, PATH_TO_VIEW } from './routes';

// Layout
import AppLayout from './components/layout/AppLayout';

// Components
import Dashboard from './components/Dashboard';
import CompanySettings from './components/CompanySettings';
import Profile from './components/Profile';
import Farms from './components/Farms';
import WaterManagement from './components/WaterManagement';
import Reports from './components/Reports';
import Harvests from './components/Harvests';
import NutrientManagement from './components/NutrientManagement';
import AuditLogViewer from './components/AuditLogViewer';
import TeamManagement from './components/TeamManagement';
import OnboardingWizard from './components/OnboardingWizard';
import GlobalModals from './components/GlobalModals';
import WeatherForecast from './components/WeatherForecast';
import Analytics from './components/Analytics';
import ComplianceDashboard from './components/compliance/ComplianceDashboard';
import DeadlineCalendar from './components/compliance/DeadlineCalendar';
import LicenseManagement from './components/compliance/LicenseManagement';
import WPSCompliance from './components/compliance/WPSCompliance';
import ComplianceReports from './components/compliance/ComplianceReports';
import ComplianceSettings from './components/compliance/ComplianceSettings';
import { DiseaseDashboard } from './components/disease';
import { FSMADashboard } from './components/fsma';
import { PrimusGFSDashboard } from './components/primusgfs';
import Breadcrumbs from './components/navigation/Breadcrumbs';
import YieldForecastDashboard from './components/yield-forecast/YieldForecastDashboard';
import { TreeDetectionPage } from './components/tree-detection';
import InspectorChecklist from './components/compliance/InspectorChecklist';

import PURImportPage from './components/pur-import/PURImportPage';
import CommandPalette from './components/CommandPalette';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { onboardingAPI } from './services/api';
import './components/OnboardingWizard.css';

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

  const { isDarkMode, toggleTheme } = useTheme();

  const location = useLocation();
  const navigate = useNavigate();
  const currentView = PATH_TO_VIEW[location.pathname] || 'dashboard';

  const handleNavigate = (viewId) => {
    const path = VIEW_TO_PATH[viewId];
    if (path) {
      navigate(path);
    }
  };

  // Onboarding state
  const [onboardingStatus, setOnboardingStatus] = useState(null);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  // ============================================================================
  // CHECK ONBOARDING STATUS
  // ============================================================================
  useEffect(() => {
    const checkOnboarding = async () => {
      if (!isAuthenticated || !currentCompany) {
        setCheckingOnboarding(false);
        return;
      }

      try {
        const response = await onboardingAPI.getStatus();
        setOnboardingStatus(response.data);
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        setOnboardingStatus({ onboarding_completed: true });
      } finally {
        setCheckingOnboarding(false);
      }
    };

    if (isAuthenticated && currentCompany) {
      setCheckingOnboarding(true);
      checkOnboarding();
    } else {
      setCheckingOnboarding(false);
    }
  }, [isAuthenticated, currentCompany]);

  // ============================================================================
  // ONBOARDING HANDLERS
  // ============================================================================
  const handleOnboardingComplete = async () => {
    try {
      await onboardingAPI.complete();
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
    setOnboardingStatus({ onboarding_completed: true });
  };

  const handleOnboardingSkip = async () => {
    try {
      await onboardingAPI.skip();
    } catch (error) {
      console.error('Error skipping onboarding:', error);
    }
    setOnboardingStatus({ onboarding_completed: true, skipped: true });
  };

  // ============================================================================
  // AUTH HANDLERS
  // ============================================================================
  const handleLogout = async () => {
    await logout();
  };

  const handleSwitchCompany = async (companyId) => {
    await switchCompany(companyId);
    setCheckingOnboarding(true);
    setOnboardingStatus(null);
  };

  // ============================================================================
  // LOADING STATE
  // ============================================================================
  if (authLoading || checkingOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
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
  // ONBOARDING WIZARD
  // ============================================================================
  if (onboardingStatus && !onboardingStatus.onboarding_completed) {
    return (
      <OnboardingWizard
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
      />
    );
  }

  // ============================================================================
  // MAIN AUTHENTICATED UI
  // ============================================================================
  return (
    <AppLayout
      isDarkMode={isDarkMode}
      onToggleTheme={toggleTheme}
      user={user}
      currentCompany={currentCompany}
      companies={companies}
      onLogout={handleLogout}
      onSwitchCompany={handleSwitchCompany}
    >
      <ErrorBoundary level="section" name="Page Content" key={currentView}>
        <Routes>
            <Route index element={<Dashboard onNavigate={handleNavigate} />} />
            <Route path="farms" element={
              <div className="p-6">
                <Breadcrumbs currentView="farms" onNavigate={handleNavigate} />
                <Farms />
              </div>
            } />
            <Route path="applications" element={
              <div className="p-6">
                <Breadcrumbs currentView="applications" onNavigate={handleNavigate} />
                <PURImportPage onNavigate={handleNavigate} />
              </div>
            } />
            <Route path="pur-import" element={
              <div className="p-6">
                <Breadcrumbs currentView="pur-import" onNavigate={handleNavigate} />
                <PURImportPage onNavigate={handleNavigate} initialStep="upload" />
              </div>
            } />
            <Route path="reports" element={
              <div className="p-6">
                <Breadcrumbs currentView="reports" onNavigate={handleNavigate} />
                <Reports />
              </div>
            } />
            <Route path="harvests" element={
              <div className="p-6">
                <Breadcrumbs currentView="harvests" onNavigate={handleNavigate} />
                <Harvests />
              </div>
            } />
            <Route path="team" element={
              <div className="p-6">
                <Breadcrumbs currentView="team" onNavigate={handleNavigate} />
                <TeamManagement />
              </div>
            } />
            <Route path="company" element={
              <div className="p-6">
                <Breadcrumbs currentView="company" onNavigate={handleNavigate} />
                <CompanySettings onBack={() => handleNavigate('dashboard')} />
              </div>
            } />
            <Route path="profile" element={
              <div className="p-6">
                <Breadcrumbs currentView="profile" onNavigate={handleNavigate} />
                <Profile onBack={() => handleNavigate('dashboard')} />
              </div>
            } />
            <Route path="water" element={
              <div className="p-6">
                <Breadcrumbs currentView="water" onNavigate={handleNavigate} />
                <WaterManagement />
              </div>
            } />
            <Route path="weather" element={
              <div className="p-6">
                <Breadcrumbs currentView="weather" onNavigate={handleNavigate} />
                <WeatherForecast />
              </div>
            } />
            <Route path="analytics" element={
              <div className="p-6">
                <Breadcrumbs currentView="analytics" onNavigate={handleNavigate} />
                <Analytics />
              </div>
            } />
            <Route path="nutrients" element={
              <div className="p-6">
                <Breadcrumbs currentView="nutrients" onNavigate={handleNavigate} />
                <NutrientManagement />
              </div>
            } />
            <Route path="activity" element={
              <div className="p-6">
                <Breadcrumbs currentView="activity" onNavigate={handleNavigate} />
                <AuditLogViewer />
              </div>
            } />
            <Route path="compliance" element={<ComplianceDashboard onNavigate={handleNavigate} />} />
            <Route path="compliance/deadlines" element={<DeadlineCalendar onNavigate={handleNavigate} />} />
            <Route path="compliance/licenses" element={<LicenseManagement onNavigate={handleNavigate} />} />
            <Route path="compliance/wps" element={<WPSCompliance onNavigate={handleNavigate} />} />
            <Route path="compliance/reports" element={<ComplianceReports onNavigate={handleNavigate} />} />
            <Route path="compliance/settings" element={<ComplianceSettings onNavigate={handleNavigate} />} />
            <Route path="tree-detection" element={<TreeDetectionPage />} />
            <Route path="disease" element={<DiseaseDashboard onNavigate={handleNavigate} />} />
            <Route path="compliance/fsma" element={<FSMADashboard onNavigate={handleNavigate} />} />
            <Route path="compliance/fsma/visitors" element={<FSMADashboard onNavigate={handleNavigate} initialTab="visitors" />} />
            <Route path="compliance/fsma/cleaning" element={<FSMADashboard onNavigate={handleNavigate} initialTab="cleaning" />} />
            <Route path="compliance/fsma/meetings" element={<FSMADashboard onNavigate={handleNavigate} initialTab="meetings" />} />
            <Route path="compliance/fsma/inventory" element={<FSMADashboard onNavigate={handleNavigate} initialTab="inventory" />} />
            <Route path="compliance/fsma/phi" element={<FSMADashboard onNavigate={handleNavigate} initialTab="phi" />} />
            <Route path="compliance/fsma/audit" element={<FSMADashboard onNavigate={handleNavigate} initialTab="audit" />} />
            <Route path="compliance/primusgfs" element={<PrimusGFSDashboard onNavigate={handleNavigate} />} />
            <Route path="compliance/primusgfs/documents" element={<PrimusGFSDashboard onNavigate={handleNavigate} initialTab="documents" />} />
            <Route path="compliance/primusgfs/audits" element={<PrimusGFSDashboard onNavigate={handleNavigate} initialTab="audits" />} />
            <Route path="compliance/primusgfs/corrective-actions" element={<PrimusGFSDashboard onNavigate={handleNavigate} initialTab="corrective-actions" />} />
            <Route path="compliance/primusgfs/land" element={<PrimusGFSDashboard onNavigate={handleNavigate} initialTab="land" />} />
            <Route path="compliance/primusgfs/suppliers" element={<PrimusGFSDashboard onNavigate={handleNavigate} initialTab="suppliers" />} />
            <Route path="compliance/primusgfs/recalls" element={<PrimusGFSDashboard onNavigate={handleNavigate} initialTab="recalls" />} />
            <Route path="compliance/primusgfs/food-defense" element={<PrimusGFSDashboard onNavigate={handleNavigate} initialTab="food-defense" />} />
            <Route path="compliance/primusgfs/sanitation" element={<PrimusGFSDashboard onNavigate={handleNavigate} initialTab="sanitation" />} />
            <Route path="compliance/primusgfs/calibration" element={<PrimusGFSDashboard onNavigate={handleNavigate} initialTab="calibration" />} />
            <Route path="compliance/primusgfs/pest-control" element={<PrimusGFSDashboard onNavigate={handleNavigate} initialTab="pest-control" />} />
            <Route path="compliance/primusgfs/pre-harvest" element={<PrimusGFSDashboard onNavigate={handleNavigate} initialTab="pre-harvest" />} />
            {/* CAC Food Safety Manual V5.0 tab routes */}
            <Route path="compliance/primusgfs/profile" element={<PrimusGFSDashboard onNavigate={handleNavigate} initialTab="profile" />} />
            <Route path="compliance/primusgfs/org-roles" element={<PrimusGFSDashboard onNavigate={handleNavigate} initialTab="org-roles" />} />
            <Route path="compliance/primusgfs/committee" element={<PrimusGFSDashboard onNavigate={handleNavigate} initialTab="committee" />} />
            <Route path="compliance/primusgfs/mgmt-review" element={<PrimusGFSDashboard onNavigate={handleNavigate} initialTab="mgmt-review" />} />
            <Route path="compliance/primusgfs/training-matrix" element={<PrimusGFSDashboard onNavigate={handleNavigate} initialTab="training-matrix" />} />
            <Route path="compliance/primusgfs/training-sessions" element={<PrimusGFSDashboard onNavigate={handleNavigate} initialTab="training-sessions" />} />
            <Route path="compliance/primusgfs/perimeter" element={<PrimusGFSDashboard onNavigate={handleNavigate} initialTab="perimeter" />} />
            <Route path="compliance/primusgfs/pre-season" element={<PrimusGFSDashboard onNavigate={handleNavigate} initialTab="pre-season" />} />
            <Route path="compliance/primusgfs/field-risk" element={<PrimusGFSDashboard onNavigate={handleNavigate} initialTab="field-risk" />} />
            <Route path="compliance/primusgfs/non-conformance" element={<PrimusGFSDashboard onNavigate={handleNavigate} initialTab="non-conformance" />} />
            <Route path="compliance/primusgfs/product-holds" element={<PrimusGFSDashboard onNavigate={handleNavigate} initialTab="product-holds" />} />
            <Route path="compliance/primusgfs/supplier-verify" element={<PrimusGFSDashboard onNavigate={handleNavigate} initialTab="supplier-verify" />} />
            <Route path="compliance/primusgfs/food-fraud" element={<PrimusGFSDashboard onNavigate={handleNavigate} initialTab="food-fraud" />} />
            <Route path="compliance/primusgfs/emergency" element={<PrimusGFSDashboard onNavigate={handleNavigate} initialTab="emergency" />} />
            <Route path="compliance/primusgfs/chemical-inv" element={<PrimusGFSDashboard onNavigate={handleNavigate} initialTab="chemical-inv" />} />
            <Route path="compliance/primusgfs/sanitation-maint" element={<PrimusGFSDashboard onNavigate={handleNavigate} initialTab="sanitation-maint" />} />
            <Route path="compliance/primusgfs/cac-manual" element={<PrimusGFSDashboard onNavigate={handleNavigate} initialTab="cac-manual" />} />
            <Route path="compliance/primusgfs/audit-binder" element={<PrimusGFSDashboard onNavigate={handleNavigate} initialTab="audit-binder" />} />
            <Route path="compliance/pesticide" element={<DeadlineCalendar onNavigate={handleNavigate} />} />
            <Route path="compliance/inspector-checklist" element={<InspectorChecklist onNavigate={handleNavigate} />} />
            <Route path="yield-forecast" element={<YieldForecastDashboard />} />
            {/* Catch-all redirect to dashboard */}
            <Route path="*" element={<Dashboard onNavigate={handleNavigate} />} />
        </Routes>
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
    <ErrorBoundary level="app" name="Grove Master">
      <ThemeProvider>
        <SeasonProvider>
          <DataProvider>
            <ModalProvider>
              <AppContent />
            </ModalProvider>
          </DataProvider>
        </SeasonProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
