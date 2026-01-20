import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';

// Contexts
import { useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { ModalProvider } from './contexts/ModalContext';

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
import Login, { Register } from './components/Login';
import AcceptInvitation from './components/AcceptInvitation';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
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
import Breadcrumbs from './components/navigation/Breadcrumbs';

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

  const [authMode, setAuthMode] = useState('login');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCompanyMenu, setShowCompanyMenu] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
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
  // CHECK FOR SPECIAL ROUTES (invitation, password reset)
  // ============================================================================
  const urlParams = new URLSearchParams(window.location.search);
  const currentPath = window.location.pathname;

  // Check for invitation token
  const inviteToken = urlParams.get('invite') ||
    (currentPath.startsWith('/invite/') ? currentPath.split('/invite/')[1] : null);

  if (inviteToken) {
    return <AcceptInvitation token={inviteToken} onComplete={() => window.location.href = '/'} />;
  }

  // Check for forgot password route
  if (currentPath === '/forgot-password') {
    return <ForgotPassword />;
  }

  // Check for reset password route
  if (currentPath === '/reset-password') {
    return <ResetPassword />;
  }

  // ============================================================================
  // LOADING STATE
  // ============================================================================
  if (authLoading || checkingOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // LOGIN/REGISTER
  // ============================================================================
  if (!isAuthenticated) {
    if (authMode === 'register') {
      return <Register onSwitchToLogin={() => setAuthMode('login')} />;
    }
    return <Login onSwitchToRegister={() => setAuthMode('register')} />;
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
    { id: 'harvests', label: 'Harvests', icon: Wheat },
    { id: 'compliance', label: 'Compliance', icon: Shield },
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
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-white border-r border-gray-200 transition-all duration-300`}>
        <div className="flex flex-col h-full">
          {/* Logo/Header */}
          <div className="p-4 border-b border-gray-200">
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
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                {sidebarCollapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Company Selector */}
          {!sidebarCollapsed && currentCompany && (
            <div className="p-3 border-b border-gray-200">
              <div className="relative">
                <button
                  onClick={() => {
                    if (companies.length > 1) {
                      setShowCompanyMenu(!showCompanyMenu);
                    } else {
                      setCurrentView('company');
                    }
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Building2 className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700 truncate flex-1 text-left">
                    {currentCompany.name}
                  </span>
                  {companies.length > 1 && (
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showCompanyMenu ? 'rotate-180' : ''}`} />
                  )}
                </button>

                {showCompanyMenu && companies.length > 1 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                    {companies.map((company) => (
                      <button
                        key={company.id}
                        onClick={() => handleSwitchCompany(company.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left ${
                          company.id === currentCompany.id ? 'bg-green-50' : ''
                        }`}
                      >
                        <span className="text-sm text-gray-700 truncate">{company.name}</span>
                        {company.id === currentCompany.id && (
                          <span className="ml-auto text-green-600">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1 px-1">
                {currentCompany.role}
              </p>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  currentView === item.id
                    ? 'bg-green-100 text-green-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            ))}
          </nav>

          {/* User Section at Bottom */}
          {!sidebarCollapsed && (
            <div className="p-4 border-t border-gray-200">
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-white">{getUserInitials()}</span>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-700 truncate">
                      {user?.first_name || user?.email}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                  </div>
                </button>

                {showUserMenu && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        setCurrentView('profile');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-sm text-gray-700"
                    >
                      <User className="w-4 h-4" />
                      Profile
                    </button>
                    <hr className="my-1" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 text-left text-sm text-red-600"
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
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={handleLogout}
                className="w-full flex justify-center p-2 hover:bg-gray-100 rounded-lg text-gray-600 hover:text-red-600"
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
        {currentView === 'dashboard' && <Dashboard onNavigate={setCurrentView} />}
        {currentView === 'farms' && (
          <div className="p-6">
            <Breadcrumbs currentView={currentView} onNavigate={setCurrentView} />
            <Farms />
          </div>
        )}
        {currentView === 'reports' && (
          <div className="p-6">
            <Breadcrumbs currentView={currentView} onNavigate={setCurrentView} />
            <Reports />
          </div>
        )}
        {currentView === 'harvests' && (
          <div className="p-6">
            <Breadcrumbs currentView={currentView} onNavigate={setCurrentView} />
            <Harvests />
          </div>
        )}
        {currentView === 'team' && (
          <div className="p-6">
            <Breadcrumbs currentView={currentView} onNavigate={setCurrentView} />
            <TeamManagement />
          </div>
        )}
        {currentView === 'company' && (
          <div className="p-6">
            <Breadcrumbs currentView={currentView} onNavigate={setCurrentView} />
            <CompanySettings onBack={() => setCurrentView('dashboard')} />
          </div>
        )}
        {currentView === 'profile' && (
          <div className="p-6">
            <Breadcrumbs currentView={currentView} onNavigate={setCurrentView} />
            <Profile onBack={() => setCurrentView('dashboard')} />
          </div>
        )}
        {currentView === 'water' && (
          <div className="p-6">
            <Breadcrumbs currentView={currentView} onNavigate={setCurrentView} />
            <WaterManagement />
          </div>
        )}
        {currentView === 'weather' && (
          <div className="p-6">
            <Breadcrumbs currentView={currentView} onNavigate={setCurrentView} />
            <WeatherForecast />
          </div>
        )}
        {currentView === 'analytics' && (
          <div className="p-6">
            <Breadcrumbs currentView={currentView} onNavigate={setCurrentView} />
            <Analytics />
          </div>
        )}
        {currentView === 'nutrients' && (
          <div className="p-6">
            <Breadcrumbs currentView={currentView} onNavigate={setCurrentView} />
            <NutrientManagement />
          </div>
        )}
        {currentView === 'activity' && (
          <div className="p-6">
            <Breadcrumbs currentView={currentView} onNavigate={setCurrentView} />
            <AuditLogViewer />
          </div>
        )}
        {currentView === 'compliance' && (
          <ComplianceDashboard onNavigate={setCurrentView} />
        )}
        {currentView === 'compliance-deadlines' && (
          <DeadlineCalendar onNavigate={setCurrentView} />
        )}
        {currentView === 'compliance-licenses' && (
          <LicenseManagement onNavigate={setCurrentView} />
        )}
        {currentView === 'compliance-wps' && (
          <WPSCompliance onNavigate={setCurrentView} />
        )}
        {currentView === 'compliance-reports' && (
          <ComplianceReports onNavigate={setCurrentView} />
        )}
        {currentView === 'compliance-settings' && (
          <ComplianceSettings onNavigate={setCurrentView} />
        )}
        {currentView === 'disease' && (
          <DiseaseDashboard onNavigate={setCurrentView} />
        )}
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
    <DataProvider>
      <ModalProvider>
        <AppContent />
      </ModalProvider>
    </DataProvider>
  );
}

export default App;
