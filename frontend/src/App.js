import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Home as HomeIcon,
  Droplets,
  FileText,
  LogOut,
  Menu,
  X,
  Wheat,
  Building2,
  ChevronDown,
  User,
  Users,
  Leaf,
  Activity,
  Cloud,
  BarChart3,
  Shield,
  Bug,
  Sun,
  Moon,
  TrendingUp,
  TreePine,
} from 'lucide-react';

// Contexts
import { useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { ModalProvider } from './contexts/ModalContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { SeasonProvider } from './contexts/SeasonContext';

// Route config
import { VIEW_TO_PATH, PATH_TO_VIEW } from './routes';

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

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCompanyMenu, setShowCompanyMenu] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
    setShowUserMenu(false);
  };

  const handleSwitchCompany = async (companyId) => {
    await switchCompany(companyId);
    setShowCompanyMenu(false);
    setCheckingOnboarding(true);
    setOnboardingStatus(null);
  };

  // ============================================================================
  // LOADING STATE
  // ============================================================================
  if (authLoading || checkingOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
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
  // NAVIGATION ITEMS
  // ============================================================================
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'farms', label: 'Farms & Fields', icon: HomeIcon },
    { id: 'weather', label: 'Weather', icon: Cloud },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'water', label: 'Water Management', icon: Droplets },
    { id: 'nutrients', label: 'Nutrients', icon: Leaf },
    { id: 'harvests', label: 'Harvest & Packing', icon: Wheat },
    { id: 'yield-forecast', label: 'Yield Forecast', icon: TrendingUp },
    { id: 'compliance', label: 'Compliance', icon: Shield },
    { id: 'tree-detection', label: 'Tree Detection', icon: TreePine },
    { id: 'disease', label: 'Disease Prevention', icon: Bug },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'activity', label: 'Activity Log', icon: Activity },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'company', label: 'Company Settings', icon: Building2 },
  ];

  // ============================================================================
  // USER INITIALS
  // ============================================================================
  const getUserInitials = () => {
    if (!user) return '?';
    const first = user.first_name?.[0] || '';
    const last = user.last_name?.[0] || '';
    return (first + last).toUpperCase() || user.email[0].toUpperCase();
  };

  // ============================================================================
  // MAIN AUTHENTICATED UI
  // ============================================================================
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* Sidebar */}
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300`}>
        <div className="flex flex-col h-full">
          {/* Logo/Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              {!sidebarCollapsed && (
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
                    <circle cx="24" cy="24" r="20" fill="#2D5016"/>
                    <circle cx="24" cy="26" r="12" fill="#E8791D"/>
                    <ellipse cx="24" cy="24" rx="8" ry="10" fill="#F4A934"/>
                    <path d="M24 4C24 4 28 10 28 14C28 18 26 20 24 20C22 20 20 18 20 14C20 10 24 4 24 4Z" fill="#4A7A2A"/>
                    <path d="M24 4C24 4 20 8 18 10" stroke="#2D5016" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span className="font-bold text-bark-brown font-heading">Grove Master</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <button
                  onClick={toggleTheme}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {isDarkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-gray-600" />}
                </button>
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  {sidebarCollapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Company Selector */}
          {!sidebarCollapsed && currentCompany && (
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <button
                  onClick={() => {
                    if (companies.length > 1) {
                      setShowCompanyMenu(!showCompanyMenu);
                    } else {
                      navigate(VIEW_TO_PATH['company']);
                    }
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <Building2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate flex-1 text-left">
                    {currentCompany.name}
                  </span>
                  {companies.length > 1 && (
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showCompanyMenu ? 'rotate-180' : ''}`} />
                  )}
                </button>

                {showCompanyMenu && companies.length > 1 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 py-1">
                    {companies.map((company) => (
                      <button
                        key={company.id}
                        onClick={() => handleSwitchCompany(company.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 text-left ${
                          company.id === currentCompany.id ? 'bg-green-50 dark:bg-green-900/30' : ''
                        }`}
                      >
                        <span className="text-sm text-gray-700 dark:text-gray-200 truncate">{company.name}</span>
                        {company.id === currentCompany.id && (
                          <span className="ml-auto text-green-600 dark:text-green-400">&#10003;</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 px-1">
                {currentCompany.role}
              </p>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.id}
                to={VIEW_TO_PATH[item.id]}
                end={item.id === 'dashboard' || item.id === 'compliance'}
                className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </nav>

          {/* User Section at Bottom */}
          {!sidebarCollapsed && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-white">{getUserInitials()}</span>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                      {user?.first_name || user?.email}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                  </div>
                </button>

                {showUserMenu && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 py-1">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        navigate(VIEW_TO_PATH['profile']);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 text-left text-sm text-gray-700 dark:text-gray-200"
                    >
                      <User className="w-4 h-4" />
                      Profile
                    </button>
                    <hr className="my-1 border-gray-200 dark:border-gray-600" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-left text-sm text-red-600 dark:text-red-400"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Collapsed sidebar logout */}
          {sidebarCollapsed && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={toggleTheme}
                className="w-full flex justify-center p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 mb-2"
                title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDarkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5" />}
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex justify-center p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <ErrorBoundary level="section" name="Page Content" key={currentView}>
          <Routes>
            <Route index element={<Dashboard onNavigate={handleNavigate} />} />
            <Route path="farms" element={
              <div className="p-6">
                <Breadcrumbs currentView="farms" onNavigate={handleNavigate} />
                <Farms />
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
            <Route path="compliance/pesticide" element={<DeadlineCalendar onNavigate={handleNavigate} />} />
            <Route path="yield-forecast" element={<YieldForecastDashboard />} />
            {/* Catch-all redirect to dashboard */}
            <Route path="*" element={<Dashboard onNavigate={handleNavigate} />} />
          </Routes>
        </ErrorBoundary>
      </main>

      {/* Global Modals */}
      <GlobalModals />

      {/* Click outside to close menus */}
      {(showUserMenu || showCompanyMenu) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowUserMenu(false);
            setShowCompanyMenu(false);
          }}
        />
      )}
    </div>
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
