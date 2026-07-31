// =============================================================================
// PACKINGHOUSE DASHBOARD COMPONENT
// Main dashboard view for packinghouse pool tracking module
// =============================================================================

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Boxes,
  TrendingUp,
  DollarSign,
  Truck,
  FileText,
  Plus,
  RefreshCw,
  ChevronRight,
  Calendar,
  AlertCircle,
  BarChart3,
  Upload
} from 'lucide-react';
import { packinghouseAnalyticsAPI, poolsAPI, packinghouseDeliveriesAPI, PACKINGHOUSE_CONSTANTS } from '../../services/api';
import DrillDownModal from '../ui/DrillDownModal';
import PackinghouseList from './PackinghouseList';
import PoolList from './PoolList';
import PackinghouseAnalytics from './PackinghouseAnalytics';
import StatementList from './StatementList';

const PackinghouseDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState('');

  // Drill-down modal state
  const [drillDown, setDrillDown] = useState({ isOpen: false, title: '', subtitle: '', icon: null, columns: [], data: [], loading: false, error: null, summaryRow: null });

  const openDrillDown = async (type) => {
    const seasonParam = selectedSeason || dashboardData?.selected_season;
    const params = seasonParam ? { season: seasonParam } : {};

    const configs = {
      total_pools: {
        title: `Total Pools — ${dashboardData?.total_pools || 0}`,
        icon: Boxes,
        columns: [
          { key: 'name', label: 'Pool Name' },
          { key: 'packinghouse_name', label: 'Packinghouse' },
          { key: 'commodity', label: 'Commodity' },
          { key: 'status', label: 'Status', format: 'status' },
        ],
        fetch: () => poolsAPI.getAll(params),
        extractData: (res) => res.data.results || res.data || [],
      },
      bins_delivered: {
        title: `Delivered — ${formatNumber(dashboardData?.total_bins_this_season)}`,
        icon: Truck,
        columns: [
          { key: 'delivery_date', label: 'Date', format: 'date' },
          { key: 'ticket_number', label: 'Ticket #' },
          { key: 'field_name', label: 'Field' },
          { key: 'pool_name', label: 'Pool' },
          { key: 'bins', label: 'Qty', align: 'right', format: 'number' },
        ],
        fetch: () => packinghouseDeliveriesAPI.getAll({ ...params, ordering: '-delivery_date' }),
        extractData: (res) => res.data.results || res.data || [],
        summaryKey: 'bins',
      },
      pending_settlement: {
        title: `Pending Settlement`,
        icon: FileText,
        columns: [
          { key: 'name', label: 'Pool' },
          { key: 'packinghouse_name', label: 'Packinghouse' },
          { key: 'commodity', label: 'Commodity' },
          { key: 'status', label: 'Status', format: 'status' },
        ],
        fetch: () => poolsAPI.getAll({ ...params, status: 'closed' }),
        extractData: (res) => res.data.results || res.data || [],
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

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchDashboard();
    }
  }, [activeTab, selectedSeason]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = selectedSeason ? { season: selectedSeason } : {};
      const response = await packinghouseAnalyticsAPI.getDashboard(params);
      setDashboardData(response.data);
      // Set selected season from response if not already set
      if (!selectedSeason && response.data.selected_season) {
        setSelectedSeason(response.data.selected_season);
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleSeasonChange = (e) => {
    setSelectedSeason(e.target.value);
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatNumber = (value, decimals = 0) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value);
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'packinghouses', label: 'Packinghouses', icon: Building2 },
    { id: 'pools', label: 'Pools', icon: Boxes },
    { id: 'statements', label: 'Statements', icon: Upload },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
  ];

  const renderDashboard = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-danger-bg border border-danger/25 rounded-card p-4 text-danger">
          <AlertCircle className="inline w-5 h-5 mr-2" />
          {error}
        </div>
      );
    }

    if (!dashboardData) {
      return (
        <div className="text-center py-12 text-text-secondary">
          No data available. Add a packinghouse to get started.
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Season Header with Selector */}
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <label className="text-lg font-semibold text-text flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-primary" />
              Season:
            </label>
            <select
              value={selectedSeason || dashboardData.selected_season}
              onChange={handleSeasonChange}
              className="px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
            >
              {dashboardData.available_seasons?.map((season) => (
                <option key={season} value={season}>
                  {season}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={fetchDashboard}
            className="flex items-center text-bark-600 hover:text-text"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface-raised rounded-card border border-border p-4 cursor-pointer hover:shadow-md hover:border-green-200 transition-all" onClick={() => openDrillDown('total_pools')}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-secondary">Total Pools</p>
                <p className="text-2xl font-bold text-heading">
                  {dashboardData.total_pools || 0}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Boxes className="w-6 h-6 text-primary" />
              </div>
            </div>
            <p className="text-xs text-text-muted mt-1">{dashboardData.active_pools || 0} active &middot; Click for details</p>
          </div>

          <div className="bg-surface-raised rounded-card border border-border p-4 cursor-pointer hover:shadow-md hover:border-green-200 transition-all" onClick={() => openDrillDown('bins_delivered')}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-secondary">Delivered</p>
                <p className="text-2xl font-bold text-heading">
                  {formatNumber(dashboardData.total_bins_this_season, 0)}
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <Truck className="w-6 h-6 text-link" />
              </div>
            </div>
            <p className="text-xs text-text-muted mt-1">Click for details</p>
          </div>

          <div className="bg-surface-raised rounded-card border border-border p-4 cursor-pointer hover:shadow-md hover:border-green-200 transition-all" onClick={() => openDrillDown('pending_settlement')}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-secondary">Pending Settlement</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {dashboardData.pending_settlement}
                </p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <FileText className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
            <p className="text-xs text-text-muted mt-1">Closed pools &middot; Click for details</p>
          </div>

          <div className="bg-surface-raised rounded-card border border-border p-4 cursor-pointer hover:shadow-md hover:border-green-200 transition-all" onClick={() => setActiveTab('packinghouses')}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-secondary">Packinghouses</p>
                <p className="text-2xl font-bold text-heading">
                  {dashboardData.packinghouse_summary?.length || 0}
                </p>
              </div>
              <div className="p-3 bg-sand-200 rounded-lg">
                <Building2 className="w-6 h-6 text-bark-700" />
              </div>
            </div>
          </div>
        </div>

        {/* Packinghouse Summary */}
        {dashboardData.packinghouse_summary?.length > 0 && (
          <div className="bg-surface-raised rounded-card border border-border">
            <div className="p-4 border-b border-border">
              <h3 className=" text-text">Packinghouse Summary</h3>
            </div>
            <div className="divide-y divide-border">
              {dashboardData.packinghouse_summary.map((ph) => (
                <div key={ph.id} className="p-4 flex justify-between items-center hover:bg-cream-50">
                  <div>
                    <p className="font-medium text-heading">{ph.name}</p>
                    {ph.short_code && (
                      <span className="text-xs text-text-secondary">{ph.short_code}</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-8 text-sm">
                    <div className="text-center">
                      <p className="text-text-secondary">Pools</p>
                      <p className="font-semibold">{ph.total_pools || 0}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-text-secondary">Qty</p>
                      <p className="font-semibold">{formatNumber(ph.season_bins)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-text-secondary">Settlements</p>
                      <p className="font-semibold text-primary">{formatCurrency(ph.total_settlements)}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-text-muted" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Deliveries */}
          <div className="bg-surface-raised rounded-card border border-border">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <h3 className=" text-text">Recent Deliveries</h3>
              <Truck className="w-5 h-5 text-text-muted" />
            </div>
            <div className="divide-y divide-border max-h-64 overflow-y-auto">
              {dashboardData.recent_deliveries?.length > 0 ? (
                dashboardData.recent_deliveries.map((delivery) => (
                  <div key={delivery.id} className="p-3 hover:bg-cream-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-heading">
                          Ticket #{delivery.ticket_number}
                        </p>
                        <p className="text-sm text-text-secondary">
                          {delivery.field_name} → {delivery.pool_name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-primary">
                          {formatNumber(delivery.bins)}
                        </p>
                        <p className="text-xs text-text-muted">
                          {new Date(delivery.delivery_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-text-secondary">
                  No recent deliveries
                </div>
              )}
            </div>
          </div>

          {/* Recent Packout Reports */}
          <div className="bg-surface-raised rounded-card border border-border">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <h3 className=" text-text">Recent Packout Reports</h3>
              <FileText className="w-5 h-5 text-text-muted" />
            </div>
            <div className="divide-y divide-border max-h-64 overflow-y-auto">
              {dashboardData.recent_packouts?.length > 0 ? (
                dashboardData.recent_packouts.map((report) => (
                  <div key={report.id} className="p-3 hover:bg-cream-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-heading">
                          {report.field_name}
                        </p>
                        <p className="text-sm text-text-secondary">
                          {report.pool_name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-link">
                          {report.total_packed_percent}% packed
                        </p>
                        <p className="text-xs text-text-muted">
                          {new Date(report.report_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {report.house_avg_packed_percent && (
                      <div className="mt-1 text-xs">
                        <span className="text-text-secondary">House Avg: </span>
                        <span className={
                          parseFloat(report.total_packed_percent) >= parseFloat(report.house_avg_packed_percent)
                            ? 'text-primary'
                            : 'text-danger'
                        }>
                          {report.house_avg_packed_percent}%
                        </span>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-text-secondary">
                  No recent packout reports
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
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

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl text-text flex items-center">
          <Building2 className="w-7 h-7 mr-2 text-primary" />
          Packinghouse Pool Tracking
        </h1>
        <p className="text-text-secondary mt-1">
          Track deliveries, packout reports, and pool settlements
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 border-b border-border">
        <nav className="flex space-x-8">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center py-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-bark-700 hover:border-border-strong'
              }`}
            >
              <Icon className="w-4 h-4 mr-2" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && renderDashboard()}
      {activeTab === 'packinghouses' && <PackinghouseList />}
      {activeTab === 'pools' && <PoolList />}
      {activeTab === 'statements' && <StatementList />}
      {activeTab === 'analytics' && <PackinghouseAnalytics />}
    </div>
  );
};

export default PackinghouseDashboard;
