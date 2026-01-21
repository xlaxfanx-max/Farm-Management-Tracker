import React, { useState, useEffect } from 'react';
import {
  Droplets,
  Wheat,
  Sprout,
  Leaf,
  Cloud,
  BarChart3,
  Bell,
  Search,
  Bug
} from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { diseaseAlertsAPI } from '../services/api';

// Dashboard Components
import OperationalAlertsBanner from './dashboard/OperationalAlertsBanner';
import FarmStatusStrip from './dashboard/FarmStatusStrip';
import QuickActionsGrid from './dashboard/QuickActionsGrid';
import UnifiedTaskList from './dashboard/UnifiedTaskList';
import ModuleStatusCard from './dashboard/ModuleStatusCard';

// Existing Widgets
import WeatherWidget from './WeatherWidget';

// Disease Prevention Components
import { ProximityRiskCard } from './disease';

function Dashboard({ onNavigate }) {
  const { applications, fields, farms, waterSources, waterTests } = useData();

  // Disease alerts state
  const [diseaseAlerts, setDiseaseAlerts] = useState([]);
  const [diseaseStats, setDiseaseStats] = useState({ critical: 0, high: 0, total: 0 });

  // Calculate stats for modules
  const [moduleStats, setModuleStats] = useState({
    water: { sources: 0, testsThisMonth: 0, needsTest: 0 },
    harvests: { active: 0, thisMonth: 0, totalBins: 0 },
    applications: { total: 0, thisMonth: 0, pending: 0, purReady: 0 },
    nutrients: { applications: 0, thisMonth: 0 },
    fields: { total: 0, active: 0, acres: '0' },
    disease: { alerts: 0, critical: 0 }
  });

  // Fetch disease alerts
  useEffect(() => {
    const fetchDiseaseAlerts = async () => {
      try {
        const response = await diseaseAlertsAPI.active();
        const alerts = response.data.results || response.data || [];
        setDiseaseAlerts(alerts);

        // Calculate stats
        const critical = alerts.filter(a => a.priority === 'critical').length;
        const high = alerts.filter(a => a.priority === 'high').length;
        setDiseaseStats({ critical, high, total: alerts.length });

        // Update module stats
        setModuleStats(prev => ({
          ...prev,
          disease: { alerts: alerts.length, critical }
        }));
      } catch (err) {
        console.error('Error fetching disease alerts:', err);
      }
    };

    fetchDiseaseAlerts();
  }, []);

  useEffect(() => {
    // Calculate module statistics
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Water stats
    const activeWaterSources = waterSources.filter(ws => ws.active);

    // Application stats
    const thisMonthApps = applications.filter(app =>
      new Date(app.application_date) >= oneMonthAgo
    );
    const pendingApps = applications.filter(a => a.status === 'pending_signature');
    const purReady = applications.filter(a => a.status === 'complete' && !a.submitted_to_pur);

    // Field stats
    const activeFields = fields.filter(f => f.active);
    const totalAcres = fields.reduce((sum, f) => sum + (parseFloat(f.total_acres) || 0), 0);

    setModuleStats(prev => ({
      ...prev,
      water: {
        sources: activeWaterSources.length,
        testsThisMonth: waterTests.filter(t => new Date(t.test_date) >= oneMonthAgo).length,
        needsTest: waterSources.filter(ws => {
          if (!ws.active || !ws.test_frequency || !ws.last_test_date) return false;
          const lastTest = new Date(ws.last_test_date);
          const daysSinceTest = Math.floor((now - lastTest) / (1000 * 60 * 60 * 24));
          return daysSinceTest > ws.test_frequency;
        }).length
      },
      harvests: {
        // These would come from harvest data when available
        active: 0,
        thisMonth: 0,
        totalBins: 0
      },
      applications: {
        total: applications.length,
        thisMonth: thisMonthApps.length,
        pending: pendingApps.length,
        purReady: purReady.length
      },
      nutrients: {
        applications: 0, // Would come from nutrient data
        thisMonth: 0
      },
      fields: {
        total: fields.length,
        active: activeFields.length,
        acres: totalAcres.toFixed(0)
      }
    }));
  }, [applications, fields, farms, waterSources, waterTests]);

  // Handle navigation to different modules
  const handleNavigate = (view) => {
    if (onNavigate) {
      onNavigate(view);
    }
  };

  // Handle alert clicks
  const handleAlertClick = (module, alert) => {
    handleNavigate(module);
  };

  // Handle task clicks
  const handleTaskClick = (module, task) => {
    handleNavigate(module);
  };

  // Handle farm card click
  const handleFarmClick = (farm) => {
    handleNavigate('farms');
  };

  // Get current date formatted
  const getCurrentDate = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header Section */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-heading">Operations Dashboard</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{getCurrentDate()}</p>
            </div>
            <div className="flex items-center gap-3">
              <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors relative">
                <Bell className="w-5 h-5" />
                {moduleStats.applications.pending > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </button>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search farms, fields..."
                  className="pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm w-64 bg-white dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Operational Alerts Banner */}
        <OperationalAlertsBanner
          applications={applications}
          waterSources={waterSources}
          waterTests={waterTests}
          diseaseAlerts={diseaseAlerts}
          onAlertClick={handleAlertClick}
        />

        {/* Farm Status Strip */}
        <FarmStatusStrip
          farms={farms}
          fields={fields}
          applications={applications}
          waterSources={waterSources}
          onFarmClick={handleFarmClick}
        />

        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Quick Actions</h2>
          <QuickActionsGrid onNavigate={handleNavigate} />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tasks & Weather Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Unified Task List */}
            <UnifiedTaskList
              applications={applications}
              waterSources={waterSources}
              fields={fields}
              onTaskClick={handleTaskClick}
              maxItems={6}
            />
          </div>

          {/* Weather & Disease Risk Column */}
          <div className="space-y-6">
            <WeatherWidget />

            {/* Disease Risk Card */}
            <ProximityRiskCard
              compact={true}
              onViewDetails={() => handleNavigate('disease')}
            />
          </div>
        </div>

        {/* Module Status Cards Grid */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Module Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Water Management */}
            <ModuleStatusCard
              title="Water"
              icon={Droplets}
              color="blue"
              onClick={() => handleNavigate('water')}
              alert={moduleStats.water.needsTest > 0 ? {
                type: 'warning',
                message: `${moduleStats.water.needsTest} test${moduleStats.water.needsTest > 1 ? 's' : ''} overdue`
              } : null}
              metrics={[
                { label: 'Sources', value: moduleStats.water.sources, color: 'blue' },
                { label: 'Tests/mo', value: moduleStats.water.testsThisMonth, color: 'green' }
              ]}
            />

            {/* Harvests */}
            <ModuleStatusCard
              title="Harvests"
              icon={Wheat}
              color="amber"
              onClick={() => handleNavigate('harvests')}
              metrics={[
                { label: 'Active', value: moduleStats.harvests.active, color: 'amber' },
                { label: 'This month', value: moduleStats.harvests.thisMonth, color: 'default' }
              ]}
            />

            {/* Applications */}
            <ModuleStatusCard
              title="Applications"
              icon={Sprout}
              color="green"
              onClick={() => handleNavigate('farms')}
              alert={moduleStats.applications.pending > 0 ? {
                type: 'warning',
                message: `${moduleStats.applications.pending} pending`
              } : null}
              metrics={[
                { label: 'Total', value: moduleStats.applications.total, color: 'green' },
                { label: 'This month', value: moduleStats.applications.thisMonth, color: 'default' }
              ]}
            />

            {/* Nutrients */}
            <ModuleStatusCard
              title="Nutrients"
              icon={Leaf}
              color="green"
              onClick={() => handleNavigate('nutrients')}
              metrics={[
                { label: 'Apps', value: moduleStats.nutrients.applications, color: 'green' },
                { label: 'This month', value: moduleStats.nutrients.thisMonth, color: 'default' }
              ]}
            />

            {/* Weather */}
            <ModuleStatusCard
              title="Weather"
              icon={Cloud}
              color="cyan"
              onClick={() => handleNavigate('weather')}
              metrics={[
                { label: 'Forecast', value: 'View', color: 'default' }
              ]}
            />

            {/* Analytics */}
            <ModuleStatusCard
              title="Analytics"
              icon={BarChart3}
              color="purple"
              onClick={() => handleNavigate('analytics')}
              metrics={[
                { label: 'Reports', value: 'View', color: 'default' }
              ]}
            />

            {/* Disease Prevention */}
            <ModuleStatusCard
              title="Disease"
              icon={Bug}
              color="red"
              onClick={() => handleNavigate('disease')}
              alert={moduleStats.disease.critical > 0 ? {
                type: 'critical',
                message: `${moduleStats.disease.critical} critical`
              } : null}
              metrics={[
                { label: 'Alerts', value: moduleStats.disease.alerts, color: moduleStats.disease.critical > 0 ? 'red' : 'green' }
              ]}
            />
          </div>
        </div>

        {/* Field Summary */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Sprout className="w-4 h-4" />
            Field Summary
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">{moduleStats.fields.total}</p>
              <p className="text-xs text-gray-500">Total Fields</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{moduleStats.fields.active}</p>
              <p className="text-xs text-gray-500">Active Fields</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{moduleStats.fields.acres}</p>
              <p className="text-xs text-gray-500">Total Acres</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
