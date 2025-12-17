import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Home as HomeIcon, 
  MapPin, 
  Droplet, 
  Droplets,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  Wheat,
  Building2,
  ChevronDown,
  User,
  Users
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import Farms from './components/Farms';
import Fields from './components/Fields';
import FarmModal from './components/FarmModal';
import FieldModal from './components/FieldModal';
import WaterManagement from './components/WaterManagement';
import ApplicationModal from './components/ApplicationModal';
import WaterSourceModal from './components/WaterSourceModal';
import WaterTestModal from './components/WaterTestModal';
import Reports from './components/Reports';
import { farmsAPI, fieldsAPI, applicationsAPI, productsAPI, waterSourcesAPI, waterTestsAPI } from './services/api';
import Harvests from './components/Harvests';
import HarvestModal from './components/HarvestModal';
import HarvestLoadModal from './components/HarvestLoadModal';
import HarvestLaborModal from './components/HarvestLaborModal';
import BuyerModal from './components/BuyerModal';
import LaborContractorModal from './components/LaborContractorModal';
import WellModal from './components/WellModal';
import WellReadingModal from './components/WellReadingModal';
import WellSourceModal from './components/WellSourceModal';

// NEW: Import authentication and team management
import { useAuth } from './contexts/AuthContext';
import Login, { Register } from './components/Login';
import TeamManagement from './components/TeamManagement';
import AcceptInvitation from './components/AcceptInvitation';


function App() {
  // ============================================================================
  // AUTHENTICATION - NEW
  // ============================================================================
  const { 
    isAuthenticated, 
    loading: authLoading, 
    user, 
    currentCompany,
    companies,
    logout,
    switchCompany 
  } = useAuth();

  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCompanyMenu, setShowCompanyMenu] = useState(false);

  // ============================================================================
  // State for data
  // ============================================================================
  const [farms, setFarms] = useState([]);
  const [fields, setFields] = useState([]);
  const [applications, setApplications] = useState([]);
  const [products, setProducts] = useState([]);
  const [waterSources, setWaterSources] = useState([]);
  const [waterTests, setWaterTests] = useState([]);
  
  // UI State
  const [currentView, setCurrentView] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Modal State
  const [showFarmModal, setShowFarmModal] = useState(false);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [showAppModal, setShowAppModal] = useState(false);
  const [showWaterSourceModal, setShowWaterSourceModal] = useState(false);
  const [showWaterTestModal, setShowWaterTestModal] = useState(false);
  
  const [currentFarm, setCurrentFarm] = useState(null);
  const [currentField, setCurrentField] = useState(null);
  const [currentApplication, setCurrentApplication] = useState(null);
  const [currentWaterSource, setCurrentWaterSource] = useState(null);
  const [currentWaterTest, setCurrentWaterTest] = useState(null);
  const [selectedWaterSource, setSelectedWaterSource] = useState(null);
  // Well modal state
  const [showWellModal, setShowWellModal] = useState(false);
  const [currentWell, setCurrentWell] = useState(null);
  const [showWellReadingModal, setShowWellReadingModal] = useState(false);
  const [selectedWellForReading, setSelectedWellForReading] = useState(null);
  const [showWellSourceModal, setShowWellSourceModal] = useState(false);
  const [currentWellSource, setCurrentWellSource] = useState(null);
  
  // Add preselectedFarmId state for field modal
  const [preselectedFarmId, setPreselectedFarmId] = useState(null);

  // Harvest tracking state
  const [showHarvestModal, setShowHarvestModal] = useState(false);
  const [showHarvestLoadModal, setShowHarvestLoadModal] = useState(false);
  const [showHarvestLaborModal, setShowHarvestLaborModal] = useState(false);
  const [showBuyerModal, setShowBuyerModal] = useState(false);
  const [showLaborContractorModal, setShowLaborContractorModal] = useState(false);
  const [currentHarvest, setCurrentHarvest] = useState(null);
  const [selectedHarvestId, setSelectedHarvestId] = useState(null);
  const [preselectedFieldId, setPreselectedFieldId] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Water Management
  const [waterModal, setWaterModal] = useState({ type: null, data: null });

  // ============================================================================
  // Load data only when authenticated
  // ============================================================================
  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, currentCompany]); // Reload when company changes

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [farmsRes, fieldsRes, appsRes, productsRes, waterSourcesRes, waterTestsRes] = await Promise.all([
        farmsAPI.getAll(),
        fieldsAPI.getAll(),
        applicationsAPI.getAll(),
        productsAPI.getAll(),
        waterSourcesAPI.getAll(),
        waterTestsAPI.getAll()
      ]);

      setFarms(farmsRes.data.results || farmsRes.data || []);
      setFields(fieldsRes.data.results || fieldsRes.data || []);
      setApplications(appsRes.data.results || appsRes.data || []);
      setProducts(productsRes.data.results || productsRes.data || []);
      setWaterSources(waterSourcesRes.data.results || waterSourcesRes.data || []);
      setWaterTests(waterTestsRes.data.results || waterTestsRes.data || []);
    } catch (err) {
      setError('Failed to load data. Please check your connection.');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // AUTHENTICATION HANDLERS - NEW
  // ============================================================================
  const handleLogout = async () => {
    await logout();
    setShowUserMenu(false);
  };

  const handleSwitchCompany = async (companyId) => {
    await switchCompany(companyId);
    setShowCompanyMenu(false);
    // Data will reload due to useEffect dependency on currentCompany
  };

  // ============================================================================
  // Check for invitation token in URL
  // ============================================================================
  const urlParams = new URLSearchParams(window.location.search);
  const inviteToken = urlParams.get('invite') || 
    (window.location.pathname.startsWith('/invite/') ? window.location.pathname.split('/invite/')[1] : null);
  
  if (inviteToken) {
    return <AcceptInvitation token={inviteToken} onComplete={() => window.location.href = '/'} />;
  }

  // ============================================================================
  // Show loading while checking auth
  // ============================================================================
  if (authLoading) {
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
  // Show login/register if not authenticated
  // ============================================================================
  if (!isAuthenticated) {
    if (authMode === 'register') {
      return <Register onSwitchToLogin={() => setAuthMode('login')} />;
    }
    return <Login onSwitchToRegister={() => setAuthMode('register')} />;
  }

  // ============================================================================
  // Farm handlers (existing)
  // ============================================================================
  const handleSaveFarm = async (farmData) => {
    try {
      if (currentFarm) {
        await farmsAPI.update(currentFarm.id, farmData);
      } else {
        await farmsAPI.create(farmData);
      }
      await loadData();
      setShowFarmModal(false);
      setCurrentFarm(null);
    } catch (err) {
      console.error('Error saving farm:', err);
      alert('Failed to save farm');
    }
  };

  const handleEditFarm = async (farm, autoSave = false) => {
    if (autoSave) {
      try {
        await farmsAPI.update(farm.id, farm);
        await loadData();
      } catch (err) {
        console.error('Error auto-saving farm:', err);
      }
    } else {
      setCurrentFarm(farm);
      setShowFarmModal(true);
    }
  };

  const handleDeleteFarm = async (farmId) => {
    if (window.confirm('Are you sure you want to delete this farm?')) {
      try {
        await farmsAPI.delete(farmId);
        await loadData();
      } catch (err) {
        console.error('Error deleting farm:', err);
        alert('Failed to delete farm');
      }
    }
  };

  // Field handlers
  const handleSaveField = async (fieldData) => {
    try {
      if (currentField) {
        await fieldsAPI.update(currentField.id, fieldData);
      } else {
        await fieldsAPI.create(fieldData);
      }
      await loadData();
      setShowFieldModal(false);
      setCurrentField(null);
      setPreselectedFarmId(null);
    } catch (err) {
      console.error('Error saving field:', err);
      alert('Failed to save field');
    }
  };

  const handleEditField = (field) => {
    setCurrentField(field);
    setPreselectedFarmId(null);
    setShowFieldModal(true);
  };

  const handleDeleteField = async (fieldId) => {
    if (window.confirm('Are you sure you want to delete this field?')) {
      try {
        await fieldsAPI.delete(fieldId);
        await loadData();
      } catch (err) {
        console.error('Error deleting field:', err);
        alert('Failed to delete field');
      }
    }
  };

  // Application handlers
  const handleSaveApplication = async (appData) => {
    try {
      console.log('Saving application data:', appData);
      if (currentApplication) {
        await applicationsAPI.update(currentApplication.id, appData);
      } else {
        await applicationsAPI.create(appData);
      }
      await loadData();
      setShowAppModal(false);
      setCurrentApplication(null);
    } catch (err) {
      console.error('Error saving application:', err);
      console.error('Error response:', err.response?.data);
      alert('Failed to save application: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleEditApplication = (app) => {
    setCurrentApplication(app);
    setShowAppModal(true);
  };

  const handleDeleteApplication = async (appId) => {
    if (window.confirm('Are you sure you want to delete this application?')) {
      try {
        await applicationsAPI.delete(appId);
        await loadData();
      } catch (err) {
        console.error('Error deleting application:', err);
        alert('Failed to delete application');
      }
    }
  };

  // Water Source handlers
  const handleSaveWaterSource = async (waterSourceData) => {
    try {
      if (currentWaterSource) {
        await waterSourcesAPI.update(currentWaterSource.id, waterSourceData);
      } else {
        await waterSourcesAPI.create(waterSourceData);
      }
      await loadData();
      setShowWaterSourceModal(false);
      setCurrentWaterSource(null);
    } catch (err) {
      console.error('Error saving water source:', err);
      alert('Failed to save water source');
    }
  };

  const handleEditWaterSource = (waterSource) => {
    setCurrentWaterSource(waterSource);
    setShowWaterSourceModal(true);
  };

  const handleDeleteWaterSource = async (sourceId) => {
    if (window.confirm('Are you sure you want to delete this water source?')) {
      try {
        await waterSourcesAPI.delete(sourceId);
        await loadData();
      } catch (err) {
        console.error('Error deleting water source:', err);
        alert('Failed to delete water source');
      }
    }
  };

  // Water Test handlers
  const handleViewTests = (waterSource) => {
    setSelectedWaterSource(waterSource);
    setCurrentView('water-tests');
  };

  const handleSaveWaterTest = async (testData) => {
    try {
      if (currentWaterTest) {
        await waterTestsAPI.update(currentWaterTest.id, testData);
      } else {
        await waterTestsAPI.create(testData);
      }
      await loadData();
      setShowWaterTestModal(false);
      setCurrentWaterTest(null);
    } catch (err) {
      console.error('Error saving water test:', err);
      alert('Failed to save water test');
    }
  };

  // Harvest handlers
  const handleNewHarvest = (fieldId = null) => {
    setCurrentHarvest(null);
    setPreselectedFieldId(fieldId);
    setShowHarvestModal(true);
  };

  const handleEditHarvest = (harvest) => {
    setCurrentHarvest(harvest);
    setPreselectedFieldId(null);
    setShowHarvestModal(true);
  };

  const handleAddLoad = (harvestId) => {
    setSelectedHarvestId(harvestId);
    setShowHarvestLoadModal(true);
  };

  const handleAddLabor = (harvestId) => {
    setSelectedHarvestId(harvestId);
    setShowHarvestLaborModal(true);
  };

  const handleHarvestSave = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Navigation items
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'farms', label: 'Farms & Fields', icon: HomeIcon },
    { id: 'water', label: 'Water Management', icon: Droplets },
    { id: 'harvests', label: 'Harvests', icon: Wheat },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'team', label: 'Team', icon: Users },
  ];

  // Get user initials
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
                  <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-bold text-gray-800">Farm Tracker</span>
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

          {/* Company Selector - NEW */}
          {!sidebarCollapsed && currentCompany && (
            <div className="p-3 border-b border-gray-200">
              <div className="relative">
                <button
                  onClick={() => setShowCompanyMenu(!showCompanyMenu)}
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
                        // Navigate to profile/settings when implemented
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-sm text-gray-700"
                    >
                      <User className="w-4 h-4" />
                      Profile
                    </button>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        // Navigate to settings when implemented
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-sm text-gray-700"
                    >
                      <Settings className="w-4 h-4" />
                      Settings
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
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              {error}
              <button onClick={loadData} className="ml-4 underline">Retry</button>
            </div>
          </div>
        )}

        {/* Content */}
        {!loading && !error && (
          <>
            {currentView === 'dashboard' && (
              <Dashboard
                applications={applications}
                fields={fields}
                farms={farms}
                waterSources={waterSources}
                onNewApplication={() => {
                  setCurrentApplication(null);
                  setShowAppModal(true);
                }}
                onNewField={(farmId) => {
                  setCurrentField(null);
                  setPreselectedFarmId(farmId || null);
                  setShowFieldModal(true);
                }}
                onNewWaterTest={() => {
                  setCurrentWaterTest(null);
                  setShowWaterTestModal(true);
                }}
                onNavigateToReports={() => setCurrentView('reports')}
                onNavigateToHarvests={() => setCurrentView('harvests')}
              />
            )}

            {currentView === 'farms' && (
              <div className="p-6">
                <Farms
                  farms={farms}
                  fields={fields}
                  applications={applications}
                  onNewFarm={() => {
                    setCurrentFarm(null);
                    setShowFarmModal(true);
                  }}
                  onEditFarm={handleEditFarm}
                  onDeleteFarm={handleDeleteFarm}
                  onNewField={(farmId) => {
                    setCurrentField(null);
                    setPreselectedFarmId(farmId || null);
                    setShowFieldModal(true);
                  }}
                  onEditField={handleEditField}
                  onDeleteField={handleDeleteField}
                  onRefresh={loadData}
                />
              </div>
            )}

            {currentView === 'reports' && (
              <Reports
                farms={farms}
                fields={fields}
                applications={applications}
              />
            )}

            {currentView === 'harvests' && (
              <div className="p-6">
                <Harvests
                  fields={fields}
                  farms={farms}
                  onNewHarvest={handleNewHarvest}
                  onEditHarvest={handleEditHarvest}
                  onAddLoad={handleAddLoad}
                  onAddLabor={handleAddLabor}
                  refreshTrigger={refreshTrigger}
                />
              </div>
            )}

            {currentView === 'team' && (
              <TeamManagement />
            )}
          </>
        )}
      </main>

      {currentView === 'water' && (
        <WaterManagement
          farms={farms}
          fields={fields}
          waterSources={waterSources}
          onRefresh={loadData}
          onOpenModal={(type, data) => {
            if (type === 'wellSource') {
              setCurrentWellSource(data);
              setShowWellSourceModal(true);
            } else if (type === 'waterSource') {
              setCurrentWaterSource(data);
              setShowWaterSourceModal(true);
            } else if (type === 'waterTest') {
              setCurrentWaterTest(data);
              setSelectedWaterSource(data?.water_source ? waterSources.find(s => s.id === data.water_source) : null);
              setShowWaterTestModal(true);
            } else if (type === 'well') {
              setCurrentWell(data);
              setShowWellModal(true);
            } else if (type === 'wellReading') {
              setSelectedWellForReading(data);
              setShowWellReadingModal(true);
            }
          }}
        />
      )}

      {showWellSourceModal && (
        <WellSourceModal
          isOpen={showWellSourceModal}
          wellSource={currentWellSource}
          farms={farms}
          fields={fields}
          onSave={() => {
            loadData();
            setShowWellSourceModal(false);
            setCurrentWellSource(null);
          }}
          onClose={() => {
            setShowWellSourceModal(false);
            setCurrentWellSource(null);
          }}
        />
      )}

      {/* Modals */}
      {showFarmModal && (
        <FarmModal
          farm={currentFarm}
          onSave={handleSaveFarm}
          onClose={() => {
            setShowFarmModal(false);
            setCurrentFarm(null);
          }}
        />
      )}

      {showFieldModal && (
        <FieldModal
          field={currentField}
          farms={farms}
          preselectedFarmId={preselectedFarmId}
          onSave={handleSaveField}
          onClose={() => {
            setShowFieldModal(false);
            setCurrentField(null);
            setPreselectedFarmId(null);
          }}
        />
      )}

      {showAppModal && (
        <ApplicationModal
          application={currentApplication}
          fields={fields}
          products={products}
          onSave={handleSaveApplication}
          onClose={() => {
            setShowAppModal(false);
            setCurrentApplication(null);
          }}
        />
      )}

      {showWaterSourceModal && (
        <WaterSourceModal
          source={currentWaterSource}
          farms={farms}
          fields={fields}
          onSave={handleSaveWaterSource}
          onClose={() => {
            setShowWaterSourceModal(false);
            setCurrentWaterSource(null);
          }}
        />
      )}

      {showWaterTestModal && (
        <WaterTestModal
          waterTest={currentWaterTest}
          waterSource={selectedWaterSource}
          waterSources={waterSources}
          onSave={handleSaveWaterTest}
          onClose={() => {
            setShowWaterTestModal(false);
            setCurrentWaterTest(null);
          }}
        />
      )}

      {showHarvestModal && (
        <HarvestModal
          isOpen={showHarvestModal}
          onClose={() => {
            setShowHarvestModal(false);
            setCurrentHarvest(null);
            setPreselectedFieldId(null);
          }}
          onSave={handleHarvestSave}
          harvest={currentHarvest}
          fields={fields}
          farms={farms}
          preselectedFieldId={preselectedFieldId}
        />
      )}

      {showHarvestLoadModal && (
        <HarvestLoadModal
          isOpen={showHarvestLoadModal}
          onClose={() => {
            setShowHarvestLoadModal(false);
            setSelectedHarvestId(null);
          }}
          onSave={handleHarvestSave}
          harvestId={selectedHarvestId}
          onAddBuyer={() => setShowBuyerModal(true)}
        />
      )}

      {showHarvestLaborModal && (
        <HarvestLaborModal
          isOpen={showHarvestLaborModal}
          onClose={() => {
            setShowHarvestLaborModal(false);
            setSelectedHarvestId(null);
          }}
          onSave={handleHarvestSave}
          harvestId={selectedHarvestId}
          onAddContractor={() => setShowLaborContractorModal(true)}
        />
      )}

      {showBuyerModal && (
        <BuyerModal
          isOpen={showBuyerModal}
          onClose={() => setShowBuyerModal(false)}
          onSave={handleHarvestSave}
        />
      )}

      {showLaborContractorModal && (
        <LaborContractorModal
          isOpen={showLaborContractorModal}
          onClose={() => setShowLaborContractorModal(false)}
          onSave={handleHarvestSave}
        />
      )}

      {showWellModal && (
        <WellModal
          isOpen={showWellModal}
          onClose={() => {
            setShowWellModal(false);
            setCurrentWell(null);
          }}
          well={currentWell}
          waterSources={waterSources}
          onSave={() => {
            loadData();
            setShowWellModal(false);
            setCurrentWell(null);
          }}
        />
      )}

      {showWellReadingModal && (
        <WellReadingModal
          isOpen={showWellReadingModal}
          onClose={() => {
            setShowWellReadingModal(false);
            setSelectedWellForReading(null);
          }}
          wellId={selectedWellForReading?.well_id}
          wellName={selectedWellForReading?.well_name}
          onSave={() => {
            loadData();
            setShowWellReadingModal(false);
            setSelectedWellForReading(null);
          }}
        />
      )}

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

export default App;