import React, { useState, useEffect, useCallback } from 'react';
import {
  Package, AlertTriangle, CheckCircle2, Clock, Search,
  Plus, ChevronRight, ArrowUpRight, XCircle, FileText,
  Truck, MapPin, RefreshCw,
} from 'lucide-react';
import { traceabilityAPI } from '../../../services/api';
import LotList from './LotList';
import LotDetail from './LotDetail';
import CreateLotFromHarvest from './CreateLotFromHarvest';
import IncidentList from './IncidentList';

const TraceabilityDashboard = () => {
  const [activeView, setActiveView] = useState('overview'); // overview, lots, lot-detail, create, incidents
  const [selectedLotId, setSelectedLotId] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await traceabilityAPI.getDashboard();
      setDashboardData(data);
      setError(null);
    } catch (err) {
      setError('Failed to load traceability dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleViewLot = (lotId) => {
    setSelectedLotId(lotId);
    setActiveView('lot-detail');
  };

  const handleBack = () => {
    setActiveView('overview');
    setSelectedLotId(null);
    loadDashboard();
  };

  const handleLotCreated = () => {
    setActiveView('lots');
    loadDashboard();
  };

  if (activeView === 'lot-detail' && selectedLotId) {
    return <LotDetail lotId={selectedLotId} onBack={handleBack} />;
  }

  if (activeView === 'create') {
    return <CreateLotFromHarvest onCreated={handleLotCreated} onCancel={handleBack} />;
  }

  if (activeView === 'lots') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            &larr; Back to Overview
          </button>
          <button
            onClick={() => setActiveView('create')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            Link Harvest
          </button>
        </div>
        <LotList onViewLot={handleViewLot} />
      </div>
    );
  }

  if (activeView === 'incidents') {
    return (
      <div className="space-y-6">
        <button
          onClick={handleBack}
          className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          &larr; Back to Overview
        </button>
        <IncidentList />
      </div>
    );
  }

  // Overview
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            FSMA Rule 204 Traceability
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Lot-level traceability for FDA Food Traceability List compliance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadDashboard}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setActiveView('create')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            Link Harvest to Lot
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Metric Cards */}
      {dashboardData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="Total Lots"
            value={dashboardData.total_lots}
            icon={Package}
            onClick={() => setActiveView('lots')}
          />
          <MetricCard
            label="FDA Ready"
            value={`${dashboardData.fda_ready_pct}%`}
            sublabel={`${dashboardData.fda_ready_count} lots`}
            icon={CheckCircle2}
            color="green"
          />
          <MetricCard
            label="Unlinked Harvests"
            value={dashboardData.unlinked_harvests}
            icon={AlertTriangle}
            color={dashboardData.unlinked_harvests > 0 ? 'amber' : 'gray'}
            onClick={() => setActiveView('create')}
          />
          <MetricCard
            label="Open Incidents"
            value={dashboardData.open_incidents}
            icon={XCircle}
            color={dashboardData.open_incidents > 0 ? 'red' : 'gray'}
            onClick={() => setActiveView('incidents')}
          />
        </div>
      )}

      {/* Status Breakdown */}
      {dashboardData && dashboardData.lots_by_status && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
            Lots by Status
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(dashboardData.lots_by_status).map(([statusKey, count]) => (
              <div
                key={statusKey}
                className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center"
              >
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  {count}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                  {statusKey.replace('_', ' ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickAction
          icon={Plus}
          title="Link Harvest"
          description="Create traceability lot from an existing harvest"
          onClick={() => setActiveView('create')}
        />
        <QuickAction
          icon={Search}
          title="Search Lots"
          description="Search and filter all traceability lots"
          onClick={() => setActiveView('lots')}
        />
        <QuickAction
          icon={AlertTriangle}
          title="Incidents"
          description="View contamination incidents and corrective actions"
          onClick={() => setActiveView('incidents')}
        />
      </div>
    </div>
  );
};

const MetricCard = ({ label, value, sublabel, icon: Icon, color = 'gray', onClick }) => {
  const colorClasses = {
    gray: 'bg-gray-50 dark:bg-gray-700/50',
    green: 'bg-green-50 dark:bg-green-900/20',
    amber: 'bg-amber-50 dark:bg-amber-900/20',
    red: 'bg-red-50 dark:bg-red-900/20',
  };

  return (
    <button
      onClick={onClick}
      className={`${colorClasses[color]} rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-left hover:shadow-md transition-shadow`}
    >
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-5 h-5 text-gray-400" />
        {onClick && <ChevronRight className="w-4 h-4 text-gray-300" />}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      {sublabel && (
        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sublabel}</div>
      )}
    </button>
  );
};

const QuickAction = ({ icon: Icon, title, description, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-start gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow text-left"
  >
    <div className="p-2 bg-primary/10 rounded-lg">
      <Icon className="w-5 h-5 text-primary" />
    </div>
    <div>
      <div className="font-medium text-gray-900 dark:text-white">{title}</div>
      <div className="text-sm text-gray-500 dark:text-gray-400">{description}</div>
    </div>
  </button>
);

export default TraceabilityDashboard;
