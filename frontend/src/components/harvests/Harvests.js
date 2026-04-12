// =============================================================================
// HARVESTS & PACKINGHOUSE COMPONENT
// Unified view for harvest tracking and packinghouse pool management
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  Wheat,
  Plus,
  Calendar,
  DollarSign,
  Package,
  Truck,
  Users,
  Clock,
  Filter,
  RefreshCw,
  Zap,
  BarChart3,
  Boxes,
  Building2,
  Layers,
  FileText,
  TrendingUp
} from 'lucide-react';
import { harvestsAPI, harvestLoadsAPI, harvestLaborAPI } from '../../services/api';
import DrillDownModal from '../ui/DrillDownModal';
import { useData } from '../../contexts/DataContext';
import { useModal } from '../../contexts/ModalContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import HarvestAnalytics from '../HarvestAnalytics';
import {
  PackinghouseList,
  PoolList,
  StatementList,
  PipelineOverview
} from '../packinghouse';
import { formatCurrency, formatNumber } from './harvestUtils';
import HarvestFilters from './HarvestFilters';
import HarvestStatistics from './HarvestStatistics';
import HarvestList from './HarvestList';
import HarvestAnalyticsTab from './HarvestAnalyticsTab';

const Harvests = () => {
  const { fields, farms } = useData();
  const confirm = useConfirm();
  const toast = useToast();
  const {
    openHarvestModal,
    openHarvestLoadModal,
    openHarvestLaborModal,
    openQuickHarvestModal,
    registerRefreshCallback,
    unregisterRefreshCallback
  } = useModal();

  // Main tab state: overview, harvests, packinghouses, pools, analytics
  const [activeTab, setActiveTab] = useState('overview');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [harvests, setHarvests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedHarvests, setExpandedHarvests] = useState({});
  const [statistics, setStatistics] = useState(null);
  const [filters, setFilters] = useState({
    farm: '',
    field: '',
    status: '',
    season: new Date().getFullYear().toString(),
    crop_variety: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  // Drill-down modal state
  const [drillDown, setDrillDown] = useState({ isOpen: false, title: '', subtitle: '', icon: null, columns: [], data: [], loading: false, error: null, summaryRow: null });

  // Dynamic unit label from statistics (Bins vs Lbs)
  const unitLabel = statistics?.primary_unit_label || 'Bins';
  const unitSingular = statistics?.primary_unit === 'LBS' ? 'Lb' : 'Bin';

  const openDrillDown = async (type) => {
    const params = {};
    if (filters.season) params.season = filters.season;
    if (filters.farm) params.farm = filters.farm;
    if (filters.field) params.field = filters.field;

    const configs = {
      total_harvests: {
        title: `Total Harvests — ${statistics?.total_harvests || 0}`,
        icon: Wheat,
        columns: [
          { key: 'harvest_date', label: 'Date', format: 'date' },
          { key: 'field_name', label: 'Field' },
          { key: 'farm_name', label: 'Farm' },
          { key: 'crop_variety', label: 'Crop' },
          { key: 'primary_quantity', label: unitLabel, align: 'right', format: 'number' },
          { key: 'status', label: 'Status', format: 'status' },
        ],
        fetch: () => harvestsAPI.getAll(params),
        extractData: (res) => res.data.results || res.data || [],
        summaryKey: 'primary_quantity',
      },
      total_bins: {
        title: `Total ${unitLabel} — ${formatNumber(statistics?.primary_quantity ?? statistics?.total_bins)}`,
        icon: Package,
        columns: [
          { key: 'harvest_date', label: 'Date', format: 'date' },
          { key: 'field_name', label: 'Field' },
          { key: 'primary_quantity', label: unitLabel, align: 'right', format: 'number' },
          { key: 'acres_harvested', label: 'Acres', align: 'right', format: 'decimal' },
          { key: 'yield_per_acre', label: 'Yield/Acre', align: 'right', format: 'decimal' },
        ],
        fetch: () => harvestsAPI.getAll(params),
        extractData: (res) => {
          const records = res.data.results || res.data || [];
          return records.map(r => ({
            ...r,
            yield_per_acre: r.acres_harvested > 0 ? ((r.primary_quantity || r.total_bins) / r.acres_harvested) : null,
          }));
        },
        summaryKey: 'primary_quantity',
      },
      total_revenue: {
        title: `Total Revenue — ${formatCurrency(statistics?.total_revenue)}`,
        icon: DollarSign,
        columns: [
          { key: 'created_at', label: 'Date', format: 'date' },
          { key: 'harvest_field_name', label: 'Field' },
          { key: 'buyer_name', label: 'Buyer' },
          { key: 'bins', label: unitLabel, align: 'right', format: 'number' },
          { key: 'price_per_unit', label: `Price/${unitSingular}`, align: 'right', format: 'currency' },
          { key: 'total_revenue', label: 'Revenue', align: 'right', format: 'currency' },
        ],
        fetch: () => harvestLoadsAPI.getAll({ ...params, ordering: '-created_at' }),
        extractData: (res) => res.data.results || res.data || [],
        summaryKey: 'total_revenue',
      },
      labor_cost: {
        title: `Labor Cost — ${formatCurrency(statistics?.total_labor_cost)}`,
        icon: Users,
        columns: [
          { key: 'created_at', label: 'Date', format: 'date' },
          { key: 'harvest_field_name', label: 'Field' },
          { key: 'contractor_name', label: 'Contractor' },
          { key: 'worker_count', label: 'Workers', align: 'right', format: 'number' },
          { key: 'total_hours', label: 'Hours', align: 'right', format: 'decimal' },
          { key: 'total_labor_cost', label: 'Cost', align: 'right', format: 'currency' },
        ],
        fetch: () => harvestLaborAPI.getAll({ ...params, ordering: '-created_at' }),
        extractData: (res) => res.data.results || res.data || [],
        summaryKey: 'total_labor_cost',
      },
      pending_payments: {
        title: `Pending Payments — ${formatCurrency(statistics?.pending_payments)}`,
        icon: Clock,
        columns: [
          { key: 'created_at', label: 'Date', format: 'date' },
          { key: 'harvest_field_name', label: 'Field' },
          { key: 'buyer_name', label: 'Buyer' },
          { key: 'bins', label: unitLabel, align: 'right', format: 'number' },
          { key: 'total_revenue', label: 'Amount', align: 'right', format: 'currency' },
          { key: 'payment_status', label: 'Status', format: 'status' },
        ],
        fetch: () => harvestLoadsAPI.getAll({ ...params, payment_status: 'pending', ordering: '-created_at' }),
        extractData: (res) => res.data.results || res.data || [],
        summaryKey: 'total_revenue',
      },
      yield_per_acre: {
        title: `Yield/Acre — ${statistics?.avg_yield_per_acre?.toFixed(1) || '0'} ${unitLabel.toLowerCase()}`,
        icon: Wheat,
        columns: [
          { key: 'field_name', label: 'Field' },
          { key: 'farm_name', label: 'Farm' },
          { key: 'acres_harvested', label: 'Acres', align: 'right', format: 'decimal' },
          { key: 'primary_quantity', label: unitLabel, align: 'right', format: 'number' },
          { key: 'yield_per_acre', label: 'Yield/Acre', align: 'right', format: 'decimal' },
        ],
        fetch: () => harvestsAPI.getAll({ ...params, ordering: '-total_bins' }),
        extractData: (res) => {
          const records = res.data.results || res.data || [];
          return records.map(r => ({
            ...r,
            yield_per_acre: r.acres_harvested > 0 ? ((r.primary_quantity || r.total_bins) / r.acres_harvested) : null,
          }));
        },
        summaryKey: 'total_bins',
      },
    };

    const config = configs[type];
    if (!config) return;

    setDrillDown({
      isOpen: true,
      title: config.title,
      subtitle: '',
      icon: config.icon,
      columns: config.columns,
      data: [],
      loading: true,
      error: null,
      summaryRow: null,
    });

    try {
      const response = await config.fetch();
      const records = config.extractData(response);
      const summaryRow = config.summaryKey
        ? { [config.columns[0].key]: 'Total', [config.summaryKey]: records.reduce((sum, r) => sum + (Number(r[config.summaryKey]) || 0), 0) }
        : null;
      setDrillDown(prev => ({
        ...prev,
        data: records,
        loading: false,
        subtitle: `${records.length} ${records.length === 1 ? 'record' : 'records'}`,
        summaryRow,
      }));
    } catch (err) {
      console.error('Drill-down fetch error:', err);
      setDrillDown(prev => ({ ...prev, loading: false, error: 'Failed to load records' }));
    }
  };

  const closeDrillDown = () => setDrillDown(prev => ({ ...prev, isOpen: false }));

  // Tab definitions - unified harvest to packing pipeline
  const tabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'harvests', label: 'Harvests', icon: Wheat },
    { id: 'packinghouses', label: 'Packinghouses', icon: Building2 },
    { id: 'pools', label: 'Pools', icon: Layers },
    { id: 'statements', label: 'Statements', icon: FileText },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  // Memoize refresh function for the callback registry
  const refreshData = useCallback(() => {
    fetchHarvests();
    fetchStatistics();
  }, []);

  // Register refresh callback with context
  useEffect(() => {
    registerRefreshCallback('harvests', refreshData);
    return () => unregisterRefreshCallback('harvests');
  }, [registerRefreshCallback, unregisterRefreshCallback, refreshData]);

  useEffect(() => {
    fetchHarvests();
    fetchStatistics();
  }, [filters]);

  const fetchHarvests = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.farm) params.farm = filters.farm;
      if (filters.field) params.field = filters.field;
      if (filters.status) params.status = filters.status;
      if (filters.season) params.season = filters.season;
      if (filters.crop_variety) params.crop_variety = filters.crop_variety;

      const response = await harvestsAPI.getAll(params);
      setHarvests(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error fetching harvests:', error);
      setHarvests([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const params = {};
      if (filters.season) params.season = filters.season;
      if (filters.farm) params.farm = filters.farm;

      const response = await harvestsAPI.getStatistics(params);
      setStatistics(response.data);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  const toggleExpand = (harvestId) => {
    setExpandedHarvests(prev => ({
      ...prev,
      [harvestId]: !prev[harvestId]
    }));
  };

  const handleDelete = async (id) => {
    const ok = await confirm({ title: 'Are you sure?', message: 'Are you sure you want to delete this harvest record?', confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    try {
      await harvestsAPI.delete(id);
      fetchHarvests();
      fetchStatistics();
    } catch (error) {
      console.error('Error deleting harvest:', error);
      toast.error('Failed to delete harvest');
    }
  };

  const handleMarkComplete = async (id) => {
    try {
      await harvestsAPI.markComplete(id);
      fetchHarvests();
    } catch (error) {
      console.error('Error marking complete:', error);
    }
  };

  const handleMarkVerified = async (id) => {
    try {
      const response = await harvestsAPI.markVerified(id);
      if (response.data.warnings?.length > 0) {
        toast.info('Verified with warnings:\n' + response.data.warnings.join('\n'));
      }
      fetchHarvests();
    } catch (error) {
      console.error('Error marking verified:', error);
    }
  };

  const getFilteredFields = () => {
    if (!filters.farm) return fields;
    return fields.filter(f => parseInt(f.farm) === parseInt(filters.farm));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Harvest & Packing</h1>
          <p className="text-gray-600 dark:text-gray-400">Track harvests from field to packinghouse</p>
        </div>
        {activeTab === 'harvests' && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowAnalytics(!showAnalytics)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                showAnalytics
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'border dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <BarChart3 size={18} />
              Analytics
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Filter size={18} />
              Filters
            </button>
            <button
              onClick={() => { fetchHarvests(); fetchStatistics(); }}
              className="flex items-center gap-2 px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={openQuickHarvestModal}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
            >
              <Zap size={18} />
              Quick Entry
            </button>
            <button
              onClick={() => openHarvestModal(null,)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              <Plus size={18} />
              Record Harvest
            </button>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id !== 'harvests') setShowAnalytics(false);
              }}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab - Pipeline Visualization */}
      {activeTab === 'overview' && (
        <PipelineOverview />
      )}

      {/* Packinghouses Tab */}
      {activeTab === 'packinghouses' && (
        <PackinghouseList />
      )}

      {/* Pools Tab */}
      {activeTab === 'pools' && (
        <PoolList />
      )}

      {/* Statements Tab */}
      {activeTab === 'statements' && (
        <StatementList />
      )}

      {/* Analytics Tab (Combined) */}
      {activeTab === 'analytics' && (
        <HarvestAnalyticsTab />
      )}

      {/* Harvests Tab Content */}
      {activeTab === 'harvests' && (
        <>
          {/* Filters Panel */}
          {showFilters && (
            <HarvestFilters
              filters={filters}
              setFilters={setFilters}
              farms={farms}
              getFilteredFields={getFilteredFields}
            />
          )}

          {/* Drill-Down Modal */}
          <DrillDownModal
            isOpen={drillDown.isOpen}
            onClose={closeDrillDown}
            title={drillDown.title}
            subtitle={drillDown.subtitle}
            icon={drillDown.icon}
            columns={drillDown.columns}
            data={drillDown.data}
            loading={drillDown.loading}
            error={drillDown.error}
            summaryRow={drillDown.summaryRow}
          />

          {/* Statistics Cards */}
          <HarvestStatistics
            statistics={statistics}
            unitLabel={unitLabel}
            openDrillDown={openDrillDown}
          />

          {/* Analytics Panel */}
          {showAnalytics && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <HarvestAnalytics />
            </div>
          )}

          {/* Harvests List */}
          {!showAnalytics && (
            <HarvestList
              harvests={harvests}
              loading={loading}
              expandedHarvests={expandedHarvests}
              toggleExpand={toggleExpand}
              openHarvestModal={openHarvestModal}
              openHarvestLoadModal={openHarvestLoadModal}
              openHarvestLaborModal={openHarvestLaborModal}
              handleMarkComplete={handleMarkComplete}
              handleMarkVerified={handleMarkVerified}
              handleDelete={handleDelete}
            />
          )}
        </>
      )}
    </div>
  );
};

export default Harvests;
