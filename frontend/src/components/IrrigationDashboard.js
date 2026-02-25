import React, { useState, useEffect, useCallback } from 'react';
import {
  Droplet,
  Thermometer,
  CloudRain,
  Sun,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  ChevronRight,
  Gauge,
  Calendar,
  TrendingUp,
  MapPin
} from 'lucide-react';
import { irrigationDashboardAPI, irrigationZonesAPI } from '../services/api';
import IrrigationZoneCard from './IrrigationZoneCard';
import IrrigationZoneModal from './IrrigationZoneModal';
import RecordIrrigationModal from './RecordIrrigationModal';

function IrrigationDashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Modal states
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [showIrrigationModal, setShowIrrigationModal] = useState(false);
  const [selectedZone, setSelectedZone] = useState(null);

  const loadDashboard = useCallback(async () => {
    try {
      setError(null);
      const response = await irrigationDashboardAPI.get();
      setDashboardData(response.data);
    } catch (err) {
      console.error('Failed to load irrigation dashboard:', err);
      setError('Failed to load irrigation data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  const handleZoneSaved = () => {
    setShowZoneModal(false);
    setSelectedZone(null);
    loadDashboard();
  };

  const handleIrrigationRecorded = () => {
    setShowIrrigationModal(false);
    setSelectedZone(null);
    loadDashboard();
  };

  const handleEditZone = (zone) => {
    setSelectedZone(zone);
    setShowZoneModal(true);
  };

  const handleRecordIrrigation = (zone) => {
    setSelectedZone(zone);
    setShowIrrigationModal(true);
  };

  const StatCard = ({ title, value, subtitle, icon: Icon, color = "blue", onClick }) => {
    const colorClasses = {
      blue: "bg-blue-50 text-blue-600 border-blue-100",
      green: "bg-primary-light text-primary border-green-100",
      orange: "bg-orange-50 text-orange-600 border-orange-100",
      red: "bg-red-50 text-red-600 border-red-100",
      purple: "bg-purple-50 text-purple-600 border-purple-100",
    };

    return (
      <div
        className={`bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow ${onClick ? 'cursor-pointer' : ''}`}
        onClick={onClick}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
            {subtitle && (
              <p className="text-sm text-gray-500">{subtitle}</p>
            )}
          </div>
          <div className={`rounded-lg p-3 ${colorClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        <span className="ml-3 text-gray-600">Loading irrigation data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-red-700 font-medium">{error}</p>
        <button
          onClick={handleRefresh}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  const data = dashboardData || {};
  const zonesByStatus = data.zones_by_status || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Irrigation Scheduling</h1>
          <p className="text-gray-600 mt-1">
            Monitor soil moisture and schedule irrigation based on crop water needs
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowZoneModal(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Zone
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Zones"
          value={data.active_zones || 0}
          subtitle={`${data.total_acres?.toFixed(1) || 0} total acres`}
          icon={MapPin}
          color="blue"
        />
        <StatCard
          title="Need Irrigation"
          value={data.zones_needing_irrigation || 0}
          subtitle="At or above MAD threshold"
          icon={AlertTriangle}
          color="red"
        />
        <StatCard
          title="Irrigation Soon"
          value={data.zones_irrigation_soon || 0}
          subtitle="Within 2 days"
          icon={Clock}
          color="orange"
        />
        <StatCard
          title="Avg Depletion"
          value={`${data.avg_depletion_pct?.toFixed(0) || 0}%`}
          subtitle="Across all zones"
          icon={Gauge}
          color="purple"
        />
      </div>

      {/* Weather Summary */}
      {(data.recent_eto_total || data.recent_rainfall_total) && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Last 7 Days Weather Summary</h3>
          <div className="flex items-center space-x-8">
            {data.recent_eto_total && (
              <div className="flex items-center">
                <Sun className="w-5 h-5 text-orange-500 mr-2" />
                <span className="text-gray-600">ETo:</span>
                <span className="ml-2 font-semibold text-gray-900">
                  {data.recent_eto_total.toFixed(2)}"
                </span>
              </div>
            )}
            {data.recent_rainfall_total && (
              <div className="flex items-center">
                <CloudRain className="w-5 h-5 text-blue-500 mr-2" />
                <span className="text-gray-600">Rainfall:</span>
                <span className="ml-2 font-semibold text-gray-900">
                  {data.recent_rainfall_total.toFixed(2)}"
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Zones Needing Irrigation */}
      {zonesByStatus.needs_irrigation?.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center mb-4">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
            <h2 className="text-lg font-semibold text-red-900">Irrigate Today</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {zonesByStatus.needs_irrigation.map((zone) => (
              <IrrigationZoneCard
                key={zone.zone_id}
                zone={zone}
                onEdit={() => handleEditZone(zone)}
                onRecordIrrigation={() => handleRecordIrrigation(zone)}
                variant="urgent"
              />
            ))}
          </div>
        </div>
      )}

      {/* Zones Needing Irrigation Soon */}
      {zonesByStatus.irrigation_soon?.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center mb-4">
            <Clock className="w-5 h-5 text-orange-600 mr-2" />
            <h2 className="text-lg font-semibold text-orange-900">Irrigation Soon</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {zonesByStatus.irrigation_soon.map((zone) => (
              <IrrigationZoneCard
                key={zone.zone_id}
                zone={zone}
                onEdit={() => handleEditZone(zone)}
                onRecordIrrigation={() => handleRecordIrrigation(zone)}
                variant="warning"
              />
            ))}
          </div>
        </div>
      )}

      {/* All Zones */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">All Irrigation Zones</h2>
          <span className="text-sm text-gray-500">{data.zones?.length || 0} zones</span>
        </div>

        {data.zones?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.zones.map((zone) => {
              const statusData = [...(zonesByStatus.needs_irrigation || []),
                                  ...(zonesByStatus.irrigation_soon || []),
                                  ...(zonesByStatus.ok || [])]
                .find(z => z.zone_id === zone.id);

              return (
                <IrrigationZoneCard
                  key={zone.id}
                  zone={{ ...zone, ...statusData }}
                  onEdit={() => handleEditZone(zone)}
                  onRecordIrrigation={() => handleRecordIrrigation(zone)}
                />
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Droplet className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No irrigation zones configured yet</p>
            <button
              onClick={() => setShowZoneModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Your First Zone
            </button>
          </div>
        )}
      </div>

      {/* Pending Recommendations */}
      {data.pending_recommendations?.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Pending Recommendations</h2>
          </div>
          <div className="space-y-3">
            {data.pending_recommendations.map((rec) => (
              <div
                key={rec.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">{rec.zone_name}</p>
                  <p className="text-sm text-gray-600">
                    {rec.recommended_depth_inches ? Number(rec.recommended_depth_inches).toFixed(2) : '-'}"
                    ({rec.recommended_duration_hours ? Number(rec.recommended_duration_hours).toFixed(1) : '-'} hours)
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">
                    {new Date(rec.recommended_date).toLocaleDateString()}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Events */}
      {data.recent_events?.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Irrigation Events</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Zone</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Depth</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.recent_events.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900">{event.zone_name}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {new Date(event.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {event.depth_inches ? Number(event.depth_inches).toFixed(2) : '-'}"
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {event.duration_hours ? Number(event.duration_hours).toFixed(1) : '-'} hrs
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {event.method_display || event.method}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showZoneModal && (
        <IrrigationZoneModal
          zone={selectedZone}
          onClose={() => {
            setShowZoneModal(false);
            setSelectedZone(null);
          }}
          onSave={handleZoneSaved}
        />
      )}

      {showIrrigationModal && selectedZone && (
        <RecordIrrigationModal
          zone={selectedZone}
          onClose={() => {
            setShowIrrigationModal(false);
            setSelectedZone(null);
          }}
          onSave={handleIrrigationRecorded}
        />
      )}
    </div>
  );
}

export default IrrigationDashboard;
