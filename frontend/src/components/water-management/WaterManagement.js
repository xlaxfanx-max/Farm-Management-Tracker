// =============================================================================
// WATER MANAGEMENT - MAIN COMPONENT (TAB CONTAINER + SHARED STATE)
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  Droplets, Plus, Activity, Droplet, Gauge, ClipboardList,
  BarChart3, Sprout, RefreshCw
} from 'lucide-react';
import api, { irrigationDashboardAPI } from '../../services/api';
import { useData } from '../../contexts/DataContext';
import { useModal } from '../../contexts/ModalContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import IrrigationDashboard from '../IrrigationDashboard';
import { AlertBanner } from './SharedComponents';
import OverviewTab from './OverviewTab';
import WaterSourcesTab from './WaterSourcesTab';
import WellsTab from './WellsTab';
import WaterTestsTab from './WaterTestsTab';
import ReportsTab from './ReportsTab';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const WaterManagement = () => {
  const { farms, fields, waterSources: initialWaterSources, loadData } = useData();
  const {
    openWaterSourceModal,
    openWaterTestModal,
    openWellModal,
    openWellReadingModal,
    openWellSourceModal,
    openBatchReadingModal
  } = useModal();
  const confirm = useConfirm();
  const toast = useToast();

  // Active tab state
  const [activeTab, setActiveTab] = useState('overview');

  // Data state
  const [waterSources, setWaterSources] = useState(initialWaterSources || []);
  const [wells, setWells] = useState([]);
  const [waterTests, setWaterTests] = useState([]);
  const [sgmaDashboard, setSgmaDashboard] = useState(null);
  const [irrigationData, setIrrigationData] = useState(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFarm, setFilterFarm] = useState('');
  const [filterGSA, setFilterGSA] = useState('');
  const [filterSourceType, setFilterSourceType] = useState('');
  const [expandedItems, setExpandedItems] = useState({});
  const [selectedSource, setSelectedSource] = useState(null);
  const [wellReadings, setWellReadings] = useState({});
  const [loadingReadings, setLoadingReadings] = useState({});
  const [deletingReading, setDeletingReading] = useState(null);

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
      const params = { source_type: 'well' };
      if (filterGSA) params.gsa = filterGSA;
      const response = await api.get('/water-sources/', { params });
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

  const fetchIrrigationData = useCallback(async () => {
    try {
      const response = await irrigationDashboardAPI.get();
      setIrrigationData(response.data);
    } catch (err) {
      console.error('Error fetching irrigation data:', err);
    }
  }, []);

  const fetchWellReadings = useCallback(async (wellId) => {
    setLoadingReadings(prev => ({ ...prev, [wellId]: true }));
    try {
      const response = await api.get('/well-readings/', { params: { water_source: wellId } });
      const readings = response.data.results || response.data || [];
      setWellReadings(prev => ({ ...prev, [wellId]: readings }));
    } catch (err) {
      console.error('Error fetching well readings:', err);
    } finally {
      setLoadingReadings(prev => ({ ...prev, [wellId]: false }));
    }
  }, []);

  const deleteWellReading = useCallback(async (readingId, wellId) => {
    try {
      await api.delete(`/well-readings/${readingId}/`);
      fetchWellReadings(wellId);
      fetchWells();
    } catch (err) {
      console.error('Error deleting reading:', err);
      toast.error('Failed to delete reading. Please try again.');
    } finally {
      setDeletingReading(null);
    }
  }, [fetchWellReadings, fetchWells, toast]);

  // Load data based on active tab
  useEffect(() => {
    setLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        if (activeTab === 'overview') {
          await Promise.all([fetchWaterSources(), fetchWells(), fetchSGMADashboard(), fetchIrrigationData()]);
        } else if (activeTab === 'sources') {
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

    fetchData();
  }, [activeTab, fetchWaterSources, fetchWells, fetchWaterTests, fetchSGMADashboard, fetchIrrigationData]);

  const refreshExpandedReadings = useCallback(() => {
    Object.keys(expandedItems).forEach(wellId => {
      if (expandedItems[wellId]) {
        fetchWellReadings(parseInt(wellId));
      }
    });
  }, [expandedItems, fetchWellReadings]);

  // Sync with parent's waterSources prop and refresh expanded readings
  useEffect(() => {
    if (initialWaterSources) {
      setWaterSources(initialWaterSources);
      refreshExpandedReadings();
    }
  }, [initialWaterSources, refreshExpandedReadings]);

  // =============================================================================
  // HANDLERS
  // =============================================================================

  const handleRefresh = async () => {
    setLoading(true);
    try {
      if (activeTab === 'overview') await Promise.all([fetchWaterSources(), fetchWells(), fetchSGMADashboard(), fetchIrrigationData()]);
      else if (activeTab === 'sources') await fetchWaterSources();
      else if (activeTab === 'wells') await Promise.all([fetchWells(), fetchSGMADashboard()]);
      else if (activeTab === 'tests') await fetchWaterTests();
      else if (activeTab === 'reports') await fetchSGMADashboard();
      else if (activeTab === 'irrigation') await fetchIrrigationData();
      refreshExpandedReadings();
      loadData();
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSource = async (sourceId) => {
    const ok = await confirm({ title: 'Are you sure?', message: 'Are you sure you want to delete this water source?', confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/water-sources/${sourceId}/`);
      handleRefresh();
    } catch (err) {
      toast.error('Failed to delete water source');
    }
  };

  const toggleExpanded = (id) => {
    const isExpanding = !expandedItems[id];
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
    if (isExpanding && !wellReadings[id]) {
      fetchWellReadings(id);
    }
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

  // =============================================================================
  // STATS CALCULATIONS
  // =============================================================================

  const sourceStats = {
    total: waterSources.length,
    wells: waterSources.filter(s => s.source_type === 'well').length,
    municipal: waterSources.filter(s => s.source_type === 'municipal').length,
    surface: waterSources.filter(s => s.source_type === 'surface').length,
    active: waterSources.filter(s => s.active).length,
  };

  const wellStats = sgmaDashboard ? {
    total: sgmaDashboard.total_wells,
    active: sgmaDashboard.active_wells,
    calibrationDue: (sgmaDashboard.calibrations_due_soon || 0) + (sgmaDashboard.calibrations_overdue || 0),
    ytdExtraction: sgmaDashboard.ytd_extraction_af,
    allocationUsed: sgmaDashboard.percent_allocation_used,
    allocationRemaining: sgmaDashboard.allocation_remaining_af
  } : {
    total: wells.length,
    active: wells.filter(w => w.status === 'active').length,
    calibrationDue: wells.filter(w => w.calibration_due_soon).length,
    ytdExtraction: wells.reduce((sum, w) => sum + (w.ytd_extraction_af || 0), 0),
    allocationUsed: 0,
    allocationRemaining: 0
  };

  // =============================================================================
  // TAB DEFINITIONS
  // =============================================================================

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'sources', label: 'Water Sources', icon: Droplet, count: sourceStats.total },
    { id: 'wells', label: 'Wells & SGMA', icon: Gauge, count: wellStats.total },
    { id: 'irrigation', label: 'Irrigation', icon: Sprout },
    { id: 'tests', label: 'Quality Tests', icon: ClipboardList },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
  ];

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Water Management</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Track water sources, wells, irrigation, and SGMA compliance</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => openWellSourceModal()}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 shadow-sm"
            >
              <Plus className="w-5 h-5" />
              Add Water Source
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 -mb-px flex space-x-1 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSearchTerm('');
                if (tab.id !== 'tests') setSelectedSource(null);
              }}
              className={`flex items-center gap-2 px-4 py-3 rounded-t-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-gray-50 dark:bg-gray-900 text-blue-600 dark:text-blue-400 border-t border-l border-r border-gray-200 dark:border-gray-700'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && (
                <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <AlertBanner
            type="error"
            title="Failed to load data"
            message={error}
            action="Retry"
            onAction={handleRefresh}
          />
        )}

        {/* Tab Content */}
        {!loading && !error && (
          <>
            {activeTab === 'overview' && (
              <OverviewTab
                waterSources={waterSources}
                wells={wells}
                sgmaDashboard={sgmaDashboard}
                irrigationData={irrigationData}
                sourceStats={sourceStats}
                wellStats={wellStats}
                setActiveTab={setActiveTab}
                openWellSourceModal={openWellSourceModal}
                openBatchReadingModal={openBatchReadingModal}
                openWellReadingModal={openWellReadingModal}
                openWaterTestModal={openWaterTestModal}
                toast={toast}
              />
            )}
            {activeTab === 'sources' && (
              <WaterSourcesTab
                filteredSources={filteredSources}
                farms={farms}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                filterFarm={filterFarm}
                setFilterFarm={setFilterFarm}
                filterSourceType={filterSourceType}
                setFilterSourceType={setFilterSourceType}
                loading={loading}
                handleRefresh={handleRefresh}
                setSelectedSource={setSelectedSource}
                setActiveTab={setActiveTab}
                openWellSourceModal={openWellSourceModal}
                openWaterSourceModal={openWaterSourceModal}
              />
            )}
            {activeTab === 'wells' && (
              <WellsTab
                filteredWells={filteredWells}
                wells={wells}
                sgmaDashboard={sgmaDashboard}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                filterGSA={filterGSA}
                setFilterGSA={setFilterGSA}
                loading={loading}
                handleRefresh={handleRefresh}
                expandedItems={expandedItems}
                toggleExpanded={toggleExpanded}
                wellReadings={wellReadings}
                loadingReadings={loadingReadings}
                deletingReading={deletingReading}
                setDeletingReading={setDeletingReading}
                deleteWellReading={deleteWellReading}
                openWellSourceModal={openWellSourceModal}
                openWellReadingModal={openWellReadingModal}
                openBatchReadingModal={openBatchReadingModal}
                toast={toast}
              />
            )}
            {activeTab === 'irrigation' && <IrrigationDashboard />}
            {activeTab === 'tests' && (
              <WaterTestsTab
                waterSources={waterSources}
                waterTests={waterTests}
                selectedSource={selectedSource}
                setSelectedSource={setSelectedSource}
                openWaterTestModal={openWaterTestModal}
              />
            )}
            {activeTab === 'reports' && (
              <ReportsTab sgmaDashboard={sgmaDashboard} />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default WaterManagement;
