import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useModal } from '../contexts/ModalContext';
import { diseaseAlertsAPI } from '../services/api';

// Dashboard Components
import AgenticHero from './dashboard/AgenticHero';
import QuickActionsGrid from './dashboard/QuickActionsGrid';
import UnifiedTaskList from './dashboard/UnifiedTaskList';
import FarmStatusStrip from './dashboard/FarmStatusStrip';
import SeasonProgressCard from './dashboard/SeasonProgressCard';

// Existing Widgets
import WeatherWidget from './WeatherWidget';

// Disease Prevention Components
import { ProximityRiskCard } from './disease';

function Dashboard({ onNavigate }) {
  const { applications, applicationEvents, fields, farms, waterSources, waterTests } = useData();
  const { openWaterTestModal } = useModal();

  // Disease alerts state
  const [diseaseAlerts, setDiseaseAlerts] = useState([]);

  // Fetch disease alerts
  useEffect(() => {
    const fetchDiseaseAlerts = async () => {
      try {
        const response = await diseaseAlertsAPI.active();
        const alerts = response.data.results || response.data || [];
        setDiseaseAlerts(alerts);
      } catch (err) {
        console.error('Error fetching disease alerts:', err);
      }
    };

    fetchDiseaseAlerts();
  }, []);

  // Handle navigation
  const handleNavigate = (view) => {
    if (onNavigate) {
      onNavigate(view);
    }
  };

  // Handle task clicks
  const handleTaskClick = (module, task) => {
    handleNavigate(module);
  };

  // Handle farm card click
  const handleFarmClick = (farm) => {
    handleNavigate('farms');
  };

  return (
    <div className="min-h-screen bg-surface dark:bg-gray-900 transition-colors">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* 1. Agentic Hero — greeting + urgent action items */}
        <AgenticHero
          applications={applications}
          applicationEvents={applicationEvents}
          waterSources={waterSources}
          diseaseAlerts={diseaseAlerts}
          onNavigate={handleNavigate}
          onOpenWaterTestModal={openWaterTestModal}
        />

        {/* 2. Quick Actions (4 buttons) */}
        <QuickActionsGrid onNavigate={handleNavigate} />

        {/* 3. Tasks + Weather / Alerts grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tasks column (2/3) */}
          <div className="lg:col-span-2">
            <UnifiedTaskList
              applications={applications}
              applicationEvents={applicationEvents}
              waterSources={waterSources}
              fields={fields}
              onTaskClick={handleTaskClick}
              maxItems={6}
            />
          </div>

          {/* Weather + Disease column (1/3) */}
          <div className="space-y-6">
            <WeatherWidget />
            <ProximityRiskCard
              compact={true}
              onViewDetails={() => handleNavigate('disease')}
            />
          </div>
        </div>

        {/* 4. Season Progress */}
        <SeasonProgressCard onNavigate={handleNavigate} />

        {/* 5. Farm Overview (compact strip) */}
        <FarmStatusStrip
          farms={farms}
          fields={fields}
          applications={applications}
          applicationEvents={applicationEvents}
          waterSources={waterSources}
          onFarmClick={handleFarmClick}
        />
      </div>
    </div>
  );
}

export default Dashboard;
