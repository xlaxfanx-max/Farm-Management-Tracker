import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Home as HomeIcon, 
  MapPin, 
  Droplet, 
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  Wheat
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import Farms from './components/Farms';
import Fields from './components/Fields';
import WaterSources from './components/WaterSources';
import WaterTests from './components/WaterTests';
import FarmModal from './components/FarmModal';
import FieldModal from './components/FieldModal';
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


function App() {
  // State for data
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
  
  // NEW: Add preselectedFarmId state for field modal
  const [preselectedFarmId, setPreselectedFarmId] = useState(null);

  // ============================================================================
  // NEW: HARVEST TRACKING STATE - ADD THESE LINES (around line 64)
  // ============================================================================
  const [showHarvestModal, setShowHarvestModal] = useState(false);
  const [showHarvestLoadModal, setShowHarvestLoadModal] = useState(false);
  const [showHarvestLaborModal, setShowHarvestLaborModal] = useState(false);
  const [showBuyerModal, setShowBuyerModal] = useState(false);
  const [showLaborContractorModal, setShowLaborContractorModal] = useState(false);
  const [currentHarvest, setCurrentHarvest] = useState(null);
  const [selectedHarvestId, setSelectedHarvestId] = useState(null);
  const [preselectedFieldId, setPreselectedFieldId] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  // ============================================================================

  useEffect(() => {
    loadData();
  }, []);

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

      setFarms(farmsRes.data.results || farmsRes.data);
      setFields(fieldsRes.data.results || fieldsRes.data);
      setApplications(appsRes.data.results || appsRes.data);
      setProducts(productsRes.data.results || productsRes.data);
      setWaterSources(waterSourcesRes.data.results || waterSourcesRes.data);
      setWaterTests(waterTestsRes.data.results || waterTestsRes.data);
    } catch (err) {
      setError('Failed to load data. Please check your connection.');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Farm handlers
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

  const handleEditFarm = (farm) => {
    setCurrentFarm(farm);
    setShowFarmModal(true);
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

  const handleDeleteWaterSource = async (waterSourceId) => {
    if (window.confirm('Are you sure you want to delete this water source?')) {
      try {
        await waterSourcesAPI.delete(waterSourceId);
        await loadData();
      } catch (err) {
        console.error('Error deleting water source:', err);
        alert('Failed to delete water source');
      }
    }
  };

  // Water Test handlers
  const handleSaveWaterTest = async (waterTestData) => {
    try {
      if (currentWaterTest) {
        await waterTestsAPI.update(currentWaterTest.id, waterTestData);
      } else {
        await waterTestsAPI.create(waterTestData);
      }
      await loadData();
      setShowWaterTestModal(false);
      setCurrentWaterTest(null);
    } catch (err) {
      console.error('Error saving water test:', err);
      alert('Failed to save water test');
    }
  };

  const handleViewTests = (waterSource) => {
    setSelectedWaterSource(waterSource);
    setCurrentView('water-tests');
  };

  // ============================================================================
  // NEW: HARVEST HANDLERS - ADD THESE FUNCTIONS (around line 258)
  // ============================================================================
  const handleNewHarvest = (fieldId = null) => {
    setCurrentHarvest(null);
    setPreselectedFieldId(fieldId);
    setShowHarvestModal(true);
  };

  const handleEditHarvest = (harvest) => {
    setCurrentHarvest(harvest);
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
    loadData(); // Refresh main data too
  };
  // ============================================================================

  const navigation = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'farms', label: 'Farms & Fields', icon: HomeIcon },
    { id: 'water', label: 'Water Quality', icon: Droplet },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'harvests', label: 'Harvests', icon: Wheat },
  ];

  const NavItem = ({ item, active }) => {
    const Icon = item.icon;
    return (
      <button
        onClick={() => setCurrentView(item.id)}
        className={`
          w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
          ${active 
            ? 'bg-green-100 text-green-700 font-medium' 
            : 'text-gray-700 hover:bg-gray-100'
          }
        `}
      >
        <Icon size={20} />
        {!sidebarCollapsed && <span>{item.label}</span>}
      </button>
    );
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-4"></div>
          <p className="text-gray-600">Loading farm data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <p className="text-red-800 font-medium mb-2">Error Loading Data</p>
            <p className="text-red-600 text-sm mb-4">{error}</p>
            <button
              onClick={loadData}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {!sidebarCollapsed && (
              <div>
                <h1 className="text-xl font-bold text-gray-900">FarmTracker</h1>
                <p className="text-xs text-gray-500 mt-1">Citrus Management</p>
              </div>
            )}
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              {sidebarCollapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navigation.map(item => (
            <NavItem key={item.id} item={item} active={currentView === item.id} />
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          {!sidebarCollapsed ? (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-600 font-semibold text-sm">MC</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">Michael's Citrus</p>
                  <p className="text-xs text-gray-500 truncate">Operator</p>
                </div>
              </div>
              <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>
              <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-1">
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <button className="w-full p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex justify-center">
                <Settings className="w-5 h-5" />
              </button>
              <button className="w-full p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex justify-center">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
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
            />
          </div>
        )}

        {currentView === 'water' && (
          <div className="p-6">
            <WaterSources
              waterSources={waterSources}
              farms={farms}
              onNewSource={() => {
                setCurrentWaterSource(null);
                setShowWaterSourceModal(true);
              }}
              onEditSource={handleEditWaterSource}
              onDeleteSource={handleDeleteWaterSource}
              onViewTests={handleViewTests}
            />
          </div>
        )}

        {currentView === 'water-tests' && selectedWaterSource && (
          <div className="p-6">
            <WaterTests
              waterSource={selectedWaterSource}
              onNewTest={() => {
                setCurrentWaterTest(null);
                setShowWaterTestModal(true);
              }}
              onEditTest={(test) => {
                setCurrentWaterTest(test);
                setShowWaterTestModal(true);
              }}
              onBack={() => setCurrentView('water')}
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

        {/* ====================================================================== */}
        {/* NEW: HARVESTS VIEW - ADD THIS BLOCK (after reports view) */}
        {/* ====================================================================== */}
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
        {/* ====================================================================== */}
      </main>

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
          waterSource={currentWaterSource}
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

      {/* ====================================================================== */}
      {/* NEW: HARVEST MODALS - ADD THESE BLOCKS (after WaterTestModal) */}
      {/* ====================================================================== */}
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
      {/* ====================================================================== */}
    </div>
  );
}

export default App;