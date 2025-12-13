import React, { useState, useEffect } from 'react';
import { MapPin, Droplet, BarChart3, AlertCircle, Home, TestTube } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Fields from './components/Fields';
import Farms from './components/Farms';
import WaterSources from './components/WaterSources';
import WaterTests from './components/WaterTests';
import ApplicationModal from './components/ApplicationModal';
import FieldModal from './components/FieldModal';
import FarmModal from './components/FarmModal';
import WaterSourceModal from './components/WaterSourceModal';
import WaterTestModal from './components/WaterTestModal';
import { farmsAPI, fieldsAPI, productsAPI, applicationsAPI, waterSourcesAPI, waterTestsAPI } from './services/api';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [applications, setApplications] = useState([]);
  const [farms, setFarms] = useState([]);
  const [fields, setFields] = useState([]);
  const [products, setProducts] = useState([]);
  const [waterSources, setWaterSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showAppModal, setShowAppModal] = useState(false);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [showFarmModal, setShowFarmModal] = useState(false);
  const [showWaterSourceModal, setShowWaterSourceModal] = useState(false);
  const [showWaterTestModal, setShowWaterTestModal] = useState(false);
  
  const [selectedApp, setSelectedApp] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editingFarm, setEditingFarm] = useState(null);
  const [editingWaterSource, setEditingWaterSource] = useState(null);
  const [editingWaterTest, setEditingWaterTest] = useState(null);
  
  // For water tests view
  const [selectedWaterSource, setSelectedWaterSource] = useState(null);
  const [showingTests, setShowingTests] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [appsResponse, fieldsResponse, farmsResponse, productsResponse, waterSourcesResponse] = await Promise.all([
        applicationsAPI.getAll(),
        fieldsAPI.getAll(),
        farmsAPI.getAll(),
        productsAPI.getAll(),
        waterSourcesAPI.getAll(),
      ]);

      setApplications(appsResponse.data.results || appsResponse.data);
      setFields(fieldsResponse.data.results || fieldsResponse.data);
      setFarms(farmsResponse.data.results || farmsResponse.data);
      setProducts(productsResponse.data.results || productsResponse.data);
      setWaterSources(waterSourcesResponse.data.results || waterSourcesResponse.data);
      
      console.log('Data loaded successfully');
    } catch (err) {
      setError('Failed to load data. Make sure the backend is running on http://localhost:8000');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveApplication = async (appData) => {
    try {
      if (selectedApp) {
        await applicationsAPI.update(selectedApp.id, appData);
      } else {
        await applicationsAPI.create(appData);
      }
      await loadData();
      setShowAppModal(false);
      setSelectedApp(null);
    } catch (err) {
      alert('Failed to save application: ' + err.message);
      console.error('Error saving application:', err);
    }
  };

  const handleDeleteApplication = async (id) => {
    if (window.confirm('Are you sure you want to delete this application?')) {
      try {
        await applicationsAPI.delete(id);
        await loadData();
        setShowAppModal(false);
        setSelectedApp(null);
      } catch (err) {
        alert('Failed to delete application: ' + err.message);
      }
    }
  };

  const handleMarkComplete = async (id) => {
    try {
      await applicationsAPI.markComplete(id);
      await loadData();
      if (selectedApp?.id === id) {
        const updated = await applicationsAPI.getById(id);
        setSelectedApp(updated.data);
      }
    } catch (err) {
      alert('Failed to mark complete: ' + err.message);
    }
  };

  const handleSaveField = async (fieldData) => {
    try {
      if (editingField) {
        await fieldsAPI.update(editingField.id, fieldData);
      } else {
        await fieldsAPI.create(fieldData);
      }
      await loadData();
      setShowFieldModal(false);
      setEditingField(null);
    } catch (err) {
      alert('Failed to save field: ' + err.message);
      console.error('Error saving field:', err);
    }
  };

  const handleDeleteField = async (id) => {
    if (window.confirm('Are you sure you want to delete this field?')) {
      try {
        await fieldsAPI.delete(id);
        await loadData();
      } catch (err) {
        alert('Failed to delete field: ' + err.message);
      }
    }
  };

  const handleSaveFarm = async (farmData) => {
    try {
      if (editingFarm) {
        await farmsAPI.update(editingFarm.id, farmData);
      } else {
        await farmsAPI.create(farmData);
      }
      await loadData();
      setShowFarmModal(false);
      setEditingFarm(null);
    } catch (err) {
      alert('Failed to save farm: ' + err.message);
      console.error('Error saving farm:', err);
    }
  };

  const handleDeleteFarm = async (id) => {
    if (window.confirm('Are you sure you want to delete this farm? This will NOT delete the fields, but they will be unassigned.')) {
      try {
        await farmsAPI.delete(id);
        await loadData();
      } catch (err) {
        alert('Failed to delete farm: ' + err.message);
      }
    }
  };

  const handleSaveWaterSource = async (sourceData) => {
    try {
      if (editingWaterSource) {
        await waterSourcesAPI.update(editingWaterSource.id, sourceData);
      } else {
        await waterSourcesAPI.create(sourceData);
      }
      await loadData();
      setShowWaterSourceModal(false);
      setEditingWaterSource(null);
    } catch (err) {
      alert('Failed to save water source: ' + err.message);
      console.error('Error saving water source:', err);
    }
  };

  const handleDeleteWaterSource = async (id) => {
    if (window.confirm('Are you sure you want to delete this water source? All associated test records will also be deleted.')) {
      try {
        await waterSourcesAPI.delete(id);
        await loadData();
        setShowingTests(false);
        setSelectedWaterSource(null);
      } catch (err) {
        alert('Failed to delete water source: ' + err.message);
      }
    }
  };

  const handleSaveWaterTest = async (testData) => {
    try {
      if (editingWaterTest) {
        await waterTestsAPI.update(editingWaterTest.id, testData);
      } else {
        await waterTestsAPI.create(testData);
      }
      // Reload is handled by WaterTests component
      setShowWaterTestModal(false);
      setEditingWaterTest(null);
    } catch (err) {
      alert('Failed to save water test: ' + err.message);
      console.error('Error saving water test:', err);
    }
  };

  const handleViewTests = (source) => {
    setSelectedWaterSource(source);
    setShowingTests(true);
  };

  const handleBackFromTests = () => {
    setShowingTests(false);
    setSelectedWaterSource(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md">
          <div className="flex items-center gap-3 mb-4 text-red-600">
            <AlertCircle size={24} />
            <h2 className="text-xl font-bold">Connection Error</h2>
          </div>
          <p className="text-slate-700 mb-4">{error}</p>
          <button 
            onClick={loadData}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <Droplet className="text-green-600" size={32} />
            <div>
              <h1 className="text-xl font-bold text-slate-800">Farm Management System</h1>
              <p className="text-sm text-slate-600">California Compliance & FSMA Records</p>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 flex gap-1">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
            { id: 'farms', label: 'Farms', icon: Home },
            { id: 'fields', label: 'Fields', icon: MapPin },
            { id: 'water', label: 'Water Quality', icon: TestTube },
          ].map(nav => {
            const Icon = nav.icon;
            return (
              <button
                key={nav.id}
                onClick={() => {
                  setCurrentView(nav.id);
                  setShowingTests(false);
                  setSelectedWaterSource(null);
                }}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 ${
                  currentView === nav.id ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-slate-600'
                }`}
              >
                <Icon size={18} />
                <span className="font-medium text-sm">{nav.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {currentView === 'dashboard' && (
          <Dashboard 
            applications={applications}
            onViewApp={(app) => {
              setSelectedApp(app);
              setShowAppModal(true);
            }}
            onNewApp={() => {
              setSelectedApp(null);
              setShowAppModal(true);
            }}
          />
        )}

        {currentView === 'farms' && (
          <Farms 
            farms={farms}
            fields={fields}
            onEditFarm={(farm) => {
              setEditingFarm(farm);
              setShowFarmModal(true);
            }}
            onDeleteFarm={handleDeleteFarm}
            onNewFarm={() => {
              setEditingFarm(null);
              setShowFarmModal(true);
            }}
          />
        )}      

        {currentView === 'fields' && (
          <Fields 
            fields={fields}
            applications={applications}
            onEditField={(field) => {
              setEditingField(field);
              setShowFieldModal(true);
            }}
            onDeleteField={handleDeleteField}
            onNewField={() => {
              setEditingField(null);
              setShowFieldModal(true);
            }}
          />
        )}

        {currentView === 'water' && !showingTests && (
          <WaterSources
            waterSources={waterSources}
            farms={farms}
            onEditSource={(source) => {
              setEditingWaterSource(source);
              setShowWaterSourceModal(true);
            }}
            onDeleteSource={handleDeleteWaterSource}
            onNewSource={() => {
              setEditingWaterSource(null);
              setShowWaterSourceModal(true);
            }}
            onViewTests={handleViewTests}
          />
        )}

        {currentView === 'water' && showingTests && selectedWaterSource && (
          <WaterTests
            waterSource={selectedWaterSource}
            onBack={handleBackFromTests}
            onNewTest={(source) => {
              setSelectedWaterSource(source);
              setEditingWaterTest(null);
              setShowWaterTestModal(true);
            }}
            onEditTest={(test) => {
              setEditingWaterTest(test);
              setShowWaterTestModal(true);
            }}
          />
        )}
      </main>

      {showAppModal && (
        <ApplicationModal
          application={selectedApp}
          fields={fields}
          products={products}
          onClose={() => {
            setShowAppModal(false);
            setSelectedApp(null);
          }}
          onSave={handleSaveApplication}
          onDelete={handleDeleteApplication}
          onMarkComplete={handleMarkComplete}
        />
      )}

      {showFarmModal && (
        <FarmModal
          farm={editingFarm}
          onClose={() => {
            setShowFarmModal(false);
            setEditingFarm(null);
          }}
          onSave={handleSaveFarm}
        />
      )}

      {showFieldModal && (
        <FieldModal
          field={editingField}
          farms={farms}
          onClose={() => {
            setShowFieldModal(false);
            setEditingField(null);
          }}
          onSave={handleSaveField}
        />
      )}

      {showWaterSourceModal && (
        <WaterSourceModal
          source={editingWaterSource}
          farms={farms}
          fields={fields}
          onClose={() => {
            setShowWaterSourceModal(false);
            setEditingWaterSource(null);
          }}
          onSave={handleSaveWaterSource}
        />
      )}

      {showWaterTestModal && (
        <WaterTestModal
          test={editingWaterTest}
          waterSource={selectedWaterSource}
          onClose={() => {
            setShowWaterTestModal(false);
            setEditingWaterTest(null);
          }}
          onSave={handleSaveWaterTest}
        />
      )}
    </div>
  );
}

export default App;