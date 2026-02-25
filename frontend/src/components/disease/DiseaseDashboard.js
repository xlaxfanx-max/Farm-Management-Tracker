import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  Shield,
  Bug,
  MapPin,
  AlertTriangle,
  Activity,
  Eye,
  RefreshCw,
  ChevronRight,
  Filter,
  Map,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  diseaseDashboardAPI,
  diseaseAlertsAPI,
  externalDetectionsAPI,
  DISEASE_CONSTANTS
} from '../../services/api';
import DiseaseAlertsList from './DiseaseAlertsList';
import ProximityRiskCard from './ProximityRiskCard';

// Lazy load ThreatMap to avoid SSR issues with Leaflet
const ThreatMap = lazy(() => import('./ThreatMap'));

/**
 * DiseaseDashboard - Main disease prevention dashboard
 *
 * Shows overview of disease risks, alerts, and regional threats.
 */
function DiseaseDashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [detections, setDetections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [mapExpanded, setMapExpanded] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [dashboardRes, detectionsRes] = await Promise.all([
        diseaseDashboardAPI.get(),
        externalDetectionsAPI.getAll({ is_active: true, limit: 10 })
      ]);

      setDashboardData(dashboardRes.data);
      setDetections(detectionsRes.data.results || detectionsRes.data || []);
    } catch (err) {
      console.error('Error fetching disease dashboard:', err);
      setError('Failed to load disease dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Get disease type info
  const getDiseaseTypeInfo = (type) => {
    return DISEASE_CONSTANTS.DISEASE_TYPES.find(d => d.value === type) || {
      label: type,
      color: '#6b7280'
    };
  };

  // Format distance
  const formatDistance = (miles) => {
    if (!miles) return 'N/A';
    return `${parseFloat(miles).toFixed(1)} mi`;
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading disease intelligence...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
              Error Loading Dashboard
            </h2>
            <p className="text-red-600 dark:text-red-300 mb-4">{error}</p>
            <button
              onClick={fetchDashboardData}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const summary = dashboardData?.summary || {};
  const alerts = dashboardData?.alerts || {};

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <Shield className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Disease Prevention
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Monitor threats and protect your groves
                </p>
              </div>
            </div>
            <button
              onClick={fetchDashboardData}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Farms Monitored */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Farms Monitored</span>
              <MapPin className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {summary.total_farms || 0}
            </p>
          </div>

          {/* Active Alerts */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Active Alerts</span>
              <AlertTriangle className={`w-4 h-4 ${alerts.active_count > 0 ? 'text-orange-500' : 'text-gray-400'}`} />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {alerts.active_count || 0}
            </p>
            {alerts.critical > 0 && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                {alerts.critical} critical
              </p>
            )}
          </div>

          {/* Average Health Score */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Avg Health Score</span>
              <Activity className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {summary.average_health_score || '--'}
              <span className="text-sm font-normal text-gray-500">/100</span>
            </p>
          </div>

          {/* Fields Monitored */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Fields Monitored</span>
              <Eye className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {summary.fields_monitored || 0}
            </p>
          </div>
        </div>

        {/* Threat Map Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            onClick={() => setMapExpanded(!mapExpanded)}
            className="w-full px-4 py-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Map className="w-4 h-4 text-blue-500" />
              Regional Threat Map
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {mapExpanded ? 'Click to collapse' : 'Click to expand'}
              </span>
              {mapExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </button>

          {mapExpanded && (
            <div className="p-4">
              <Suspense fallback={
                <div className="h-96 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                  <div className="text-center text-gray-500 dark:text-gray-400">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                    <p>Loading map...</p>
                  </div>
                </div>
              }>
                <ThreatMap height="400px" showControls={true} />
              </Suspense>
            </div>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Risk Card & Detections */}
          <div className="space-y-6">
            {/* Proximity Risk Card */}
            <ProximityRiskCard />

            {/* Recent Detections */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Bug className="w-4 h-4 text-red-500" />
                  Recent Detections (CDFA)
                </h3>
              </div>
              <div className="p-4">
                {detections.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    No active detections in your area
                  </p>
                ) : (
                  <div className="space-y-3">
                    {detections.slice(0, 5).map(detection => {
                      const typeInfo = getDiseaseTypeInfo(detection.disease_type);
                      return (
                        <div
                          key={detection.id}
                          className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <div
                            className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                            style={{ backgroundColor: typeInfo.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {detection.disease_name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {detection.city ? `${detection.city}, ` : ''}{detection.county} County
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                              {formatDate(detection.detection_date)}
                            </p>
                          </div>
                          <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                            {detection.location_type_display || detection.location_type}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Alerts */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  Disease Alerts
                </h3>
                <div className="flex items-center gap-2">
                  {alerts.unacknowledged > 0 && (
                    <span className="px-2 py-0.5 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full">
                      {alerts.unacknowledged} new
                    </span>
                  )}
                </div>
              </div>
              <div className="p-4">
                <DiseaseAlertsList
                  showFilters={true}
                  limit={10}
                  onAlertClick={(alert) => {
                    console.log('Alert clicked:', alert);
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Risk Distribution */}
        {dashboardData?.risk_distribution && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              Field Risk Distribution
            </h3>
            <div className="grid grid-cols-4 gap-4">
              {DISEASE_CONSTANTS.RISK_LEVELS.map(level => {
                const count = dashboardData.risk_distribution[level.value] || 0;
                const total = Object.values(dashboardData.risk_distribution).reduce((a, b) => a + b, 0) || 1;
                const percent = Math.round((count / total) * 100);

                return (
                  <div key={level.value} className="text-center">
                    <div
                      className="h-24 rounded-lg flex items-end justify-center mb-2"
                      style={{ backgroundColor: `${level.color}20` }}
                    >
                      <div
                        className="w-full rounded-lg transition-all duration-500"
                        style={{
                          height: `${Math.max(10, percent)}%`,
                          backgroundColor: level.color
                        }}
                      />
                    </div>
                    <p className="text-2xl font-bold" style={{ color: level.color }}>
                      {count}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                      {level.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            About Disease Prevention
          </h3>
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
            Grove Master monitors disease threats in your region using data from CDFA, satellite imagery,
            and crowdsourced scouting reports. Get alerts when diseases like HLB (Citrus Greening) or
            Asian Citrus Psyllid are detected near your farms.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500 mt-1" />
              <div>
                <p className="font-medium text-blue-900 dark:text-blue-100">HLB (Citrus Greening)</p>
                <p className="text-blue-600 dark:text-blue-400">Fatal citrus disease with no cure</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500 mt-1" />
              <div>
                <p className="font-medium text-blue-900 dark:text-blue-100">Asian Citrus Psyllid</p>
                <p className="text-blue-600 dark:text-blue-400">Vector insect that spreads HLB</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500 mt-1" />
              <div>
                <p className="font-medium text-blue-900 dark:text-blue-100">NDVI Monitoring</p>
                <p className="text-blue-600 dark:text-blue-400">Satellite-based tree health tracking</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DiseaseDashboard;
