// =============================================================================
// WATER MANAGEMENT - UNIFIED COMPONENT
// =============================================================================
// src/components/WaterManagement.js
// Combines Water Sources, Wells/SGMA, Quality Tests, and Compliance Reports
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  Droplets, Plus, Search, Filter, AlertTriangle, CheckCircle,
  Clock, ChevronDown, ChevronRight, MapPin, Gauge, Calendar,
  Edit, Trash2, Eye, FileText, RefreshCw, ArrowLeft, Droplet,
  AlertCircle, Building2, ClipboardList, BarChart3
} from 'lucide-react';
import api from '../services/api';

// =============================================================================
// CONSTANTS
// =============================================================================

const GSA_NAMES = {
  'obgma': 'Ojai Basin GMA',
  'fpbgsa': 'Fillmore & Piru Basins GSA',
  'uvrga': 'Upper Ventura River GA',
  'fcgma': 'Fox Canyon GMA',
  'other': 'Other',
  'none': 'None'
};

const BASIN_NAMES = {
  'ojai_valley': 'Ojai Valley',
  'fillmore': 'Fillmore',
  'piru': 'Piru',
  'upper_ventura_river': 'Upper Ventura River',
  'santa_paula': 'Santa Paula',
  'other': 'Other'
};

const SOURCE_TYPE_LABELS = {
  'well': 'Well',
  'municipal': 'Municipal/Public',
  'surface': 'Surface Water',
  'other': 'Other'
};

const STATUS_COLORS = {
  'active': 'bg-green-100 text-green-800',
  'inactive': 'bg-gray-100 text-gray-800',
  'standby': 'bg-yellow-100 text-yellow-800',
  'destroyed': 'bg-red-100 text-red-800',
  'monitoring': 'bg-blue-100 text-blue-800'
};

const TEST_STATUS_CONFIG = {
  'pending': { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  'pass': { label: 'Pass', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  'fail': { label: 'Fail', color: 'bg-red-100 text-red-800', icon: AlertCircle },
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const WaterManagement = ({ 
  farms, 
  fields, 
  waterSources: initialWaterSources,
  onRefresh,
  onOpenModal 
}) => {
  // Active tab state
  const [activeTab, setActiveTab] = useState('sources');
  
  // Data state
  const [waterSources, setWaterSources] = useState(initialWaterSources || []);
  const [wells, setWells] = useState([]);
  const [waterTests, setWaterTests] = useState([]);
  const [sgmaDashboard, setSgmaDashboard] = useState(null);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFarm, setFilterFarm] = useState('');
  const [filterGSA, setFilterGSA] = useState('');
  const [filterSourceType, setFilterSourceType] = useState('');
  const [expandedItems, setExpandedItems] = useState({});
  const [selectedSource, setSelectedSource] = useState(null);

  // =============================================================================
  // DATA FETCHING
  // =============================================================================

  const fetchWaterSources = useCallback(async () => {
    try {
      const response = await api.get('/water-sources/');
      setWaterSources(response.data.results || response.data || []);
    } catch (err) {
      console.error('Error fetching water sources:', err);
    }
  }, []);

  const fetchWells = useCallback(async () => {
    try {
      const params = {};
      if (filterGSA) params.gsa = filterGSA;
      const response = await api.get('/wells/', { params });
      setWells(response.data.results || response.data || []);
    } catch (err) {
      console.error('Error fetching wells:', err);
    }
  }, [filterGSA]);

  const fetchWaterTests = useCallback(async () => {
    try {
      const params = {};
      if (selectedSource) params.water_source = selectedSource.id;
      const response = await api.get('/water-tests/', { params });
      setWaterTests(response.data.results || response.data || []);
    } catch (err) {
      console.error('Error fetching water tests:', err);
    }
  }, [selectedSource]);

  const fetchSGMADashboard = useCallback(async () => {
    try {
      const response = await api.get('/sgma/dashboard/');
      setSgmaDashboard(response.data);
    } catch (err) {
      console.error('Error fetching SGMA dashboard:', err);
    }
  }, []);

  // Load data based on active tab
  useEffect(() => {
    setLoading(true);
    setError(null);
    
    const loadData = async () => {
      try {
        if (activeTab === 'sources') {
          await fetchWaterSources();
        } else if (activeTab === 'wells') {
          await Promise.all([fetchWells(), fetchSGMADashboard()]);
        } else if (activeTab === 'tests') {
          await Promise.all([fetchWaterSources(), fetchWaterTests()]);
        } else if (activeTab === 'reports') {
          await fetchSGMADashboard();
        }
      } catch (err) {
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [activeTab, fetchWaterSources, fetchWells, fetchWaterTests, fetchSGMADashboard]);

  // Sync with parent's waterSources prop
  useEffect(() => {
    if (initialWaterSources) {
      setWaterSources(initialWaterSources);
    }
  }, [initialWaterSources]);

  // =============================================================================
  // HANDLERS
  // =============================================================================

  const handleRefresh = async () => {
    setLoading(true);
    try {
      if (activeTab === 'sources') await fetchWaterSources();
      else if (activeTab === 'wells') await Promise.all([fetchWells(), fetchSGMADashboard()]);
      else if (activeTab === 'tests') await fetchWaterTests();
      else if (activeTab === 'reports') await fetchSGMADashboard();
      if (onRefresh) onRefresh();
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSource = async (sourceId) => {
    if (!window.confirm('Are you sure you want to delete this water source?')) return;
    try {
      await api.delete(`/water-sources/${sourceId}/`);
      handleRefresh();
    } catch (err) {
      alert('Failed to delete water source');
    }
  };

  const handleDeleteWell = async (wellId) => {
    if (!window.confirm('Are you sure you want to delete this well?')) return;
    try {
      await api.delete(`/wells/${wellId}/`);
      handleRefresh();
    } catch (err) {
      alert('Failed to delete well');
    }
  };

  const toggleExpanded = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // =============================================================================
  // FILTERED DATA
  // =============================================================================

  const filteredSources = waterSources.filter(source => {
    const matchesSearch = !searchTerm || 
      source.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      farms.find(f => f.id === source.farm)?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFarm = !filterFarm || source.farm === parseInt(filterFarm);
    const matchesType = !filterSourceType || source.source_type === filterSourceType;
    return matchesSearch && matchesFarm && matchesType;
  });

  const filteredWells = wells.filter(well => {
    const matchesSearch = !searchTerm ||
      well.well_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      well.water_source_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      well.farm_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGSA = !filterGSA || well.gsa === filterGSA;
    return matchesSearch && matchesGSA;
  });

  const filteredTests = waterTests.filter(test => {
    if (selectedSource) return test.water_source === selectedSource.id;
    return true;
  });

  // =============================================================================
  // STATS CALCULATIONS
  // =============================================================================

  const sourceStats = {
    total: waterSources.length,
    wells: waterSources.filter(s => s.source_type === 'well').length,
    active: waterSources.filter(s => s.active).length,
    needsTesting: waterSources.filter(s => {
      // Would need backend support for this
      return false;
    }).length
  };

  const wellStats = sgmaDashboard ? {
    total: sgmaDashboard.total_wells,
    active: sgmaDashboard.active_wells,
    calibrationDue: sgmaDashboard.calibrations_due_soon + sgmaDashboard.calibrations_overdue,
    ytdExtraction: sgmaDashboard.ytd_extraction_af
  } : {
    total: wells.length,
    active: wells.filter(w => w.status === 'active').length,
    calibrationDue: wells.filter(w => w.calibration_due_soon).length,
    ytdExtraction: wells.reduce((sum, w) => sum + (w.ytd_extraction_af || 0), 0)
  };

  // =============================================================================
  // TAB DEFINITIONS
  // =============================================================================

  const tabs = [
    { id: 'sources', label: 'Water Sources', icon: Droplet, count: sourceStats.total },
    { id: 'wells', label: 'Wells & SGMA', icon: Gauge, count: wellStats.total },
    { id: 'tests', label: 'Quality Tests', icon: ClipboardList },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
  ];

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  // =============================================================================
  // RENDER: SOURCES TAB
  // =============================================================================

  const renderSourcesTab = () => (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Droplet className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Sources</p>
              <p className="text-2xl font-bold text-gray-900">{sourceStats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-100 rounded-lg">
              <Droplets className="w-6 h-6 text-cyan-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Wells</p>
              <p className="text-2xl font-bold text-gray-900">{sourceStats.wells}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active</p>
              <p className="text-2xl font-bold text-gray-900">{sourceStats.active}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Building2 className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Farms</p>
              <p className="text-2xl font-bold text-gray-900">{farms.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search sources..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <select
            value={filterFarm}
            onChange={(e) => setFilterFarm(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Farms</option>
            {farms.map(farm => (
              <option key={farm.id} value={farm.id}>{farm.name}</option>
            ))}
          </select>
          <select
            value={filterSourceType}
            onChange={(e) => setFilterSourceType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            <option value="well">Well</option>
            <option value="municipal">Municipal</option>
            <option value="surface">Surface Water</option>
          </select>
          <button onClick={handleRefresh} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Sources List */}
      {filteredSources.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Droplet className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No water sources found</h3>
          <p className="text-gray-500 mb-4">Get started by adding your first well or water source.</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => onOpenModal('wellSource', null)}
              className="inline-flex items-center gap-2 bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700"
            >
              <Plus className="w-5 h-5" />
              Add Well
            </button>
            <button
              onClick={() => onOpenModal('waterSource', null)}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Add Other Source
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSources.map(source => {
            const farm = farms.find(f => f.id === source.farm);
            const isWell = source.source_type === 'well';
            const wellData = isWell ? wells.find(w => w.water_source === source.id) : null;
            
            return (
              <div key={source.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                <div className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{source.name}</h3>
                      <p className="text-sm text-gray-500">{farm?.name}</p>
                    </div>
                    {source.active ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-gray-400" />
                    )}
                  </div>

                  {/* Type Badge */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      isWell ? 'bg-cyan-100 text-cyan-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {SOURCE_TYPE_LABELS[source.source_type]}
                    </span>
                    {isWell && wellData && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                        {GSA_NAMES[wellData.gsa] || wellData.gsa}
                      </span>
                    )}
                  </div>

                  {/* Usage */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {source.used_for_irrigation && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Irrigation</span>
                    )}
                    {source.used_for_washing && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Washing</span>
                    )}
                    {source.used_for_pesticide_mixing && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Pesticide</span>
                    )}
                  </div>

                  {/* Test Frequency */}
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                    <Clock className="w-4 h-4" />
                    <span>Tests every {source.test_frequency_days} days</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setSelectedSource(source);
                        setActiveTab('tests');
                      }}
                      className="flex-1 px-3 py-1.5 text-sm text-blue-600 border border-blue-600 rounded hover:bg-blue-50"
                    >
                      View Tests
                    </button>
                    {isWell && (
                      <button
                        onClick={() => {
                          setActiveTab('wells');
                        }}
                        className="flex-1 px-3 py-1.5 text-sm text-cyan-600 border border-cyan-600 rounded hover:bg-cyan-50"
                      >
                        SGMA Details
                      </button>
                    )}
                    <button
                      onClick={() => {
                        // Use unified wellSource modal for wells, regular waterSource modal for others
                        if (source.source_type === 'well') {
                          onOpenModal('wellSource', source);
                        } else {
                          onOpenModal('waterSource', source);
                        }
                      }}
                      className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // =============================================================================
  // RENDER: WELLS TAB
  // =============================================================================

  const renderWellsTab = () => (
    <div className="space-y-6">
      {/* SGMA Dashboard Summary */}
      {sgmaDashboard && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Droplets className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Wells</p>
                <p className="text-2xl font-bold text-gray-900">{sgmaDashboard.total_wells}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-100 rounded-lg">
                <Gauge className="w-6 h-6 text-cyan-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">YTD Extraction</p>
                <p className="text-2xl font-bold text-gray-900">{sgmaDashboard.ytd_extraction_af?.toFixed(1)} AF</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Allocation Remaining</p>
                <p className="text-2xl font-bold text-gray-900">{sgmaDashboard.allocation_remaining_af?.toFixed(1)} AF</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Calibration Due</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(sgmaDashboard.calibrations_due_soon || 0) + (sgmaDashboard.calibrations_overdue || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {sgmaDashboard?.alerts?.length > 0 && (
        <div className="space-y-2">
          {sgmaDashboard.alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg flex items-start gap-3 ${
                alert.type === 'error' ? 'bg-red-50 border border-red-200' :
                alert.type === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
                'bg-blue-50 border border-blue-200'
              }`}
            >
              <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${
                alert.type === 'error' ? 'text-red-600' :
                alert.type === 'warning' ? 'text-yellow-600' :
                'text-blue-600'
              }`} />
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  alert.type === 'error' ? 'text-red-800' :
                  alert.type === 'warning' ? 'text-yellow-800' :
                  'text-blue-800'
                }`}>{alert.message}</p>
                <p className={`text-xs mt-1 ${
                  alert.type === 'error' ? 'text-red-600' :
                  alert.type === 'warning' ? 'text-yellow-600' :
                  'text-blue-600'
                }`}>{alert.action}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search wells..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>
          <select
            value={filterGSA}
            onChange={(e) => setFilterGSA(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
          >
            <option value="">All GSAs</option>
            <option value="obgma">Ojai Basin GMA</option>
            <option value="fpbgsa">Fillmore & Piru Basins GSA</option>
            <option value="uvrga">Upper Ventura River GA</option>
            <option value="fcgma">Fox Canyon GMA</option>
          </select>
          <button onClick={handleRefresh} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Wells List */}
      {filteredWells.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Droplets className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No wells found</h3>
          <p className="text-gray-500 mb-4">
            Wells are created from Water Sources with type "Well". Add a water source first, then add SGMA details.
          </p>
          <button
            onClick={() => onOpenModal('well', null)}
            className="inline-flex items-center gap-2 bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700"
          >
            <Plus className="w-5 h-5" />
            Add Well Details
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredWells.map(well => (
            <div key={well.id} className="bg-white rounded-lg shadow overflow-hidden">
              {/* Well Header */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleExpanded(well.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {expandedItems[well.id] ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                    <div className="p-2 bg-cyan-100 rounded-lg">
                      <Droplets className="w-6 h-6 text-cyan-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {well.well_name || well.water_source_name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {well.farm_name} • {GSA_NAMES[well.gsa] || well.gsa}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {well.calibration_due_soon && (
                      <span className="flex items-center gap-1 text-yellow-600 text-sm">
                        <Clock className="w-4 h-4" />
                        Calibration Due
                      </span>
                    )}
                    <div className="text-right">
                      <p className="text-sm text-gray-500">YTD Extraction</p>
                      <p className="font-semibold text-gray-900">
                        {(well.ytd_extraction_af || 0).toFixed(2)} AF
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[well.status] || 'bg-gray-100'}`}>
                      {well.status}
                    </span>
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => onOpenModal('wellReading', { well_id: well.id, well_name: well.well_name })}
                        className="p-2 text-cyan-600 hover:bg-cyan-50 rounded-lg"
                        title="Add Reading"
                      >
                        <Gauge className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => onOpenModal('well', well)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        title="Edit"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedItems[well.id] && (
                <div className="border-t border-gray-200 bg-gray-50 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Well Information</h4>
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-gray-500">GSA Well ID:</dt>
                          <dd className="text-gray-900">{well.gsa_well_id || '-'}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-500">Basin:</dt>
                          <dd className="text-gray-900">{BASIN_NAMES[well.basin] || well.basin}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-500">Meter Units:</dt>
                          <dd className="text-gray-900">{well.flowmeter_units || '-'}</dd>
                        </div>
                      </dl>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Calibration</h4>
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-gray-500">Status:</dt>
                          <dd className={well.meter_calibration_current ? 'text-green-600' : 'text-red-600'}>
                            {well.meter_calibration_current ? 'Current' : 'Due/Overdue'}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-500">Next Due:</dt>
                          <dd className="text-gray-900">{formatDate(well.next_calibration_due)}</dd>
                        </div>
                      </dl>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Latest Reading</h4>
                      {well.latest_reading ? (
                        <dl className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Date:</dt>
                            <dd className="text-gray-900">{formatDate(well.latest_reading.date)}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Reading:</dt>
                            <dd className="text-gray-900">{well.latest_reading.meter_reading}</dd>
                          </div>
                        </dl>
                      ) : (
                        <p className="text-sm text-gray-500">No readings recorded</p>
                      )}
                      <button
                        onClick={() => onOpenModal('wellReading', { well_id: well.id, well_name: well.well_name })}
                        className="mt-3 text-sm text-cyan-600 hover:text-cyan-700"
                      >
                        + Add Reading
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // =============================================================================
  // RENDER: TESTS TAB
  // =============================================================================

  const renderTestsTab = () => (
    <div className="space-y-6">
      {/* Back button if viewing specific source */}
      {selectedSource && (
        <button
          onClick={() => setSelectedSource(null)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to all sources
        </button>
      )}

      {/* Source selector or details */}
      {selectedSource ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-blue-900">{selectedSource.name}</h3>
              <p className="text-sm text-blue-700">
                {SOURCE_TYPE_LABELS[selectedSource.source_type]} • Tests every {selectedSource.test_frequency_days} days
              </p>
            </div>
            <button
              onClick={() => onOpenModal('waterTest', { water_source: selectedSource.id })}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Add Test
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Water Source</label>
          <select
            value=""
            onChange={(e) => {
              const source = waterSources.find(s => s.id === parseInt(e.target.value));
              setSelectedSource(source);
            }}
            className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Choose a source to view tests...</option>
            {waterSources.map(source => (
              <option key={source.id} value={source.id}>
                {source.name} ({SOURCE_TYPE_LABELS[source.source_type]})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tests List */}
      {selectedSource && (
        filteredTests.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No test records</h3>
            <p className="text-gray-500 mb-4">Start tracking water quality by adding your first test result.</p>
            <button
              onClick={() => onOpenModal('waterTest', { water_source: selectedSource.id })}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Add First Test
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTests.map(test => {
              const statusConfig = TEST_STATUS_CONFIG[test.status] || TEST_STATUS_CONFIG.pending;
              const StatusIcon = statusConfig.icon;

              return (
                <div
                  key={test.id}
                  className="bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer p-4"
                  onClick={() => onOpenModal('waterTest', test)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{formatDate(test.test_date)}</h3>
                      <span className="text-sm text-gray-500">
                        {test.test_type === 'microbial' ? 'Microbial' :
                         test.test_type === 'chemical' ? 'Chemical' : 'Microbial & Chemical'}
                      </span>
                    </div>
                    <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${statusConfig.color}`}>
                      <StatusIcon className="w-4 h-4" />
                      {statusConfig.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {test.ecoli_result !== null && (
                      <div>
                        <p className="text-gray-500">E. coli</p>
                        <p className="font-medium">{test.ecoli_result} CFU/100mL</p>
                      </div>
                    )}
                    {test.ph_level !== null && (
                      <div>
                        <p className="text-gray-500">pH Level</p>
                        <p className="font-medium">{test.ph_level}</p>
                      </div>
                    )}
                    {test.lab_name && (
                      <div>
                        <p className="text-gray-500">Lab</p>
                        <p className="font-medium">{test.lab_name}</p>
                      </div>
                    )}
                  </div>

                  {test.status === 'fail' && test.corrective_actions && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm">
                      <p className="font-medium text-red-800">Corrective Actions:</p>
                      <p className="text-red-700">{test.corrective_actions}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );

  // =============================================================================
  // RENDER: REPORTS TAB
  // =============================================================================

  const renderReportsTab = () => (
    <div className="space-y-6">
      {/* SGMA Compliance Overview */}
      {sgmaDashboard ? (
        <>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">SGMA Compliance Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-gray-500">Water Year</p>
                <p className="text-xl font-bold text-gray-900">{sgmaDashboard.water_year}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Current Period</p>
                <p className="text-xl font-bold text-gray-900">{sgmaDashboard.current_period}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">YTD Extraction</p>
                <p className="text-xl font-bold text-cyan-600">{sgmaDashboard.ytd_extraction_af?.toFixed(2)} AF</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Allocation Used</p>
                <p className={`text-xl font-bold ${
                  sgmaDashboard.percent_allocation_used > 80 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {sgmaDashboard.percent_allocation_used?.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          {/* Upcoming Deadlines */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Deadlines</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <Calendar className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-500">Next Report Due</p>
                  <p className="font-semibold text-gray-900">{formatDate(sgmaDashboard.next_report_due)}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <Gauge className="w-8 h-8 text-yellow-600" />
                <div>
                  <p className="text-sm text-gray-500">Next Calibration Due</p>
                  <p className="font-semibold text-gray-900">{formatDate(sgmaDashboard.next_calibration_due)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Wells by GSA */}
          {sgmaDashboard.wells_by_gsa?.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Wells by GSA</h3>
              <div className="space-y-3">
                {sgmaDashboard.wells_by_gsa.map((gsa, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{GSA_NAMES[gsa.gsa] || gsa.gsa}</p>
                      <p className="text-sm text-gray-500">{gsa.active} active of {gsa.count} wells</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-cyan-600">{(gsa.ytd_extraction || 0).toFixed(2)} AF</p>
                      <p className="text-xs text-gray-500">YTD Extraction</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No report data available</h3>
          <p className="text-gray-500">Add wells and meter readings to see SGMA compliance reports.</p>
        </div>
      )}
    </div>
  );

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Water Management</h2>
          <p className="text-gray-600">Manage water sources, wells, quality testing, and SGMA compliance</p>
        </div>
        <button
          onClick={() => {
            if (activeTab === 'wells') onOpenModal('wellSource', null);
            else if (activeTab === 'tests' && selectedSource) onOpenModal('waterTest', { water_source: selectedSource.id });
            else if (activeTab === 'sources') onOpenModal('wellSource', null); // Default to well for sources tab
            else onOpenModal('waterSource', null);
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          {activeTab === 'wells' ? 'Add Well' : activeTab === 'tests' ? 'Add Test' : 'Add Well'}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSearchTerm('');
                if (tab.id !== 'tests') setSelectedSource(null);
              }}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
              {tab.count !== undefined && (
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-6">
          {error}
          <button onClick={handleRefresh} className="ml-4 underline">Retry</button>
        </div>
      )}

      {/* Tab Content */}
      {!loading && !error && (
        <>
          {activeTab === 'sources' && renderSourcesTab()}
          {activeTab === 'wells' && renderWellsTab()}
          {activeTab === 'tests' && renderTestsTab()}
          {activeTab === 'reports' && renderReportsTab()}
        </>
      )}
    </div>
  );
};

export default WaterManagement;
