// =============================================================================
// OVERVIEW TAB
// =============================================================================

import React from 'react';
import {
  Droplets, Plus, AlertTriangle, CheckCircle, Clock, ChevronRight,
  MapPin, Gauge, FileText, Sprout, TrendingUp, Waves,
  ThermometerSun, CloudRain
} from 'lucide-react';
import { MetricCard, AlertBanner, QuickActionButton, formatNumber } from './SharedComponents';
import { SOURCE_TYPE_LABELS } from './constants';

const OverviewTab = ({
  waterSources,
  wells,
  sgmaDashboard,
  irrigationData,
  sourceStats,
  wellStats,
  setActiveTab,
  openWellSourceModal,
  openBatchReadingModal,
  openWellReadingModal,
  openWaterTestModal,
  toast
}) => {
  const alerts = [];

  // Irrigation alerts (priority)
  const zonesNeedingIrrigation = irrigationData?.zones_needing_irrigation || 0;
  const zonesIrrigationSoon = irrigationData?.zones_irrigation_soon || 0;

  if (zonesNeedingIrrigation > 0) {
    alerts.push({
      type: 'error',
      title: `${zonesNeedingIrrigation} zone${zonesNeedingIrrigation > 1 ? 's' : ''} need irrigation today`,
      message: 'Soil moisture has reached the management allowable depletion threshold',
      action: 'View Irrigation',
      onAction: () => setActiveTab('irrigation')
    });
  }

  if (zonesIrrigationSoon > 0) {
    alerts.push({
      type: 'warning',
      title: `${zonesIrrigationSoon} zone${zonesIrrigationSoon > 1 ? 's' : ''} need irrigation soon`,
      message: 'Plan irrigation within the next 2 days',
      action: 'View Zones',
      onAction: () => setActiveTab('irrigation')
    });
  }

  // Check for calibration alerts
  if (wellStats.calibrationDue > 0) {
    alerts.push({
      type: 'warning',
      title: `${wellStats.calibrationDue} meter calibration${wellStats.calibrationDue > 1 ? 's' : ''} due`,
      message: 'Keep your flow meters calibrated for accurate SGMA reporting',
      action: 'View Wells',
      onAction: () => setActiveTab('wells')
    });
  }

  // Check for allocation usage
  if (wellStats.allocationUsed > 80) {
    alerts.push({
      type: wellStats.allocationUsed > 95 ? 'error' : 'warning',
      title: `${formatNumber(wellStats.allocationUsed)}% of water allocation used`,
      message: `${formatNumber(wellStats.allocationRemaining)} AF remaining this year`,
      action: 'View Reports',
      onAction: () => setActiveTab('reports')
    });
  }

  // Add SGMA alerts if available
  if (sgmaDashboard?.alerts) {
    sgmaDashboard.alerts.forEach(alert => {
      alerts.push({
        type: alert.type === 'error' ? 'error' : alert.type === 'warning' ? 'warning' : 'info',
        title: alert.message,
        message: alert.action
      });
    });
  }

  // Irrigation stats
  const irrigationStats = {
    totalZones: irrigationData?.active_zones || 0,
    totalAcres: irrigationData?.total_acres || 0,
    avgDepletion: irrigationData?.avg_depletion_pct || 0,
    recentEto: irrigationData?.recent_eto_total,
    recentRain: irrigationData?.recent_rainfall_total,
    pendingRecs: irrigationData?.pending_recommendations?.length || 0
  };

  // Zones needing attention
  const urgentZones = irrigationData?.zones_by_status?.needs_irrigation || [];
  const soonZones = irrigationData?.zones_by_status?.irrigation_soon || [];

  return (
    <div className="space-y-6">
      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.slice(0, 4).map((alert, idx) => (
            <AlertBanner key={idx} {...alert} />
          ))}
        </div>
      )}

      {/* IRRIGATION PRIORITY SECTION */}
      <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-900/20 dark:via-emerald-900/20 dark:to-teal-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
              <Sprout className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Irrigation Status</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Real-time crop water needs based on ET data</p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('irrigation')}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover shadow-sm transition-colors"
          >
            <span>Full Dashboard</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Irrigation Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur rounded-xl p-4 border border-green-100 dark:border-green-800">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Active Zones</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{irrigationStats.totalZones}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{formatNumber(irrigationStats.totalAcres)} acres</p>
          </div>

          <div className={`bg-white/80 backdrop-blur rounded-xl p-4 border ${zonesNeedingIrrigation > 0 ? 'border-red-200 bg-red-50/50' : 'border-green-100'}`}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className={`w-4 h-4 ${zonesNeedingIrrigation > 0 ? 'text-red-600' : 'text-gray-400'}`} />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Need Water</span>
            </div>
            <p className={`text-2xl font-bold ${zonesNeedingIrrigation > 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>{zonesNeedingIrrigation}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Irrigate today</p>
          </div>

          <div className={`bg-white/80 backdrop-blur rounded-xl p-4 border ${zonesIrrigationSoon > 0 ? 'border-amber-200 bg-amber-50/50' : 'border-green-100'}`}>
            <div className="flex items-center gap-2 mb-1">
              <Clock className={`w-4 h-4 ${zonesIrrigationSoon > 0 ? 'text-amber-600' : 'text-gray-400'}`} />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Soon</span>
            </div>
            <p className={`text-2xl font-bold ${zonesIrrigationSoon > 0 ? 'text-amber-600' : 'text-gray-900 dark:text-white'}`}>{zonesIrrigationSoon}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Within 2 days</p>
          </div>

          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur rounded-xl p-4 border border-green-100 dark:border-green-800">
            <div className="flex items-center gap-2 mb-1">
              <Gauge className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Avg Depletion</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(irrigationStats.avgDepletion, 0)}%</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Soil moisture used</p>
          </div>

          {irrigationStats.recentEto !== null && irrigationStats.recentEto !== undefined && (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur rounded-xl p-4 border border-green-100 dark:border-green-800">
              <div className="flex items-center gap-2 mb-1">
                <ThermometerSun className="w-4 h-4 text-orange-500" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">7-Day ETo</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(irrigationStats.recentEto, 2)}"</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Evapotranspiration</p>
            </div>
          )}

          {irrigationStats.recentRain !== null && irrigationStats.recentRain !== undefined && (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur rounded-xl p-4 border border-green-100 dark:border-green-800">
              <div className="flex items-center gap-2 mb-1">
                <CloudRain className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">7-Day Rain</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(irrigationStats.recentRain, 2)}"</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Precipitation</p>
            </div>
          )}
        </div>

        {/* Zones Needing Attention */}
        {(urgentZones.length > 0 || soonZones.length > 0) && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Zones Needing Attention</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {urgentZones.slice(0, 3).map(zone => (
                <div key={zone.zone_id} className="bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 rounded-xl p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-medium rounded-full">Irrigate Now</span>
                      </div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">{zone.zone_name}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{zone.field_name} • {zone.crop_type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-red-600 dark:text-red-400">{formatNumber(zone.depletion_pct, 0)}%</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">depleted</p>
                    </div>
                  </div>
                  {zone.recommended_depth_inches && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Recommended:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-200">{formatNumber(zone.recommended_depth_inches, 2)}" ({formatNumber(zone.recommended_duration_hours, 1)} hrs)</span>
                    </div>
                  )}
                </div>
              ))}
              {soonZones.slice(0, 3 - urgentZones.slice(0, 3).length).map(zone => (
                <div key={zone.zone_id} className="bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800 rounded-xl p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium rounded-full">Soon</span>
                      </div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">{zone.zone_name}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{zone.field_name} • {zone.crop_type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{formatNumber(zone.depletion_pct, 0)}%</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">depleted</p>
                    </div>
                  </div>
                  {zone.days_until_irrigation !== null && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Irrigate in:</span>
                      <span className="font-medium text-amber-700">{zone.days_until_irrigation} day{zone.days_until_irrigation !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {(urgentZones.length + soonZones.length) > 3 && (
              <button
                onClick={() => setActiveTab('irrigation')}
                className="text-sm text-primary hover:text-primary-hover font-medium flex items-center gap-1"
              >
                View all {urgentZones.length + soonZones.length} zones needing attention
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* No zones state */}
        {irrigationStats.totalZones === 0 && (
          <div className="text-center py-6">
            <Sprout className="w-10 h-10 text-green-300 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400 mb-3">No irrigation zones configured yet</p>
            <button
              onClick={() => setActiveTab('irrigation')}
              className="text-primary hover:text-primary-hover font-medium text-sm"
            >
              Set up your first irrigation zone →
            </button>
          </div>
        )}
      </div>

      {/* Secondary Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Water Sources"
          value={sourceStats.total}
          subtitle={`${sourceStats.active} active`}
          icon={Droplets}
          color="blue"
          onClick={() => setActiveTab('sources')}
        />
        <MetricCard
          title="Wells"
          value={wellStats.total}
          subtitle={wellStats.calibrationDue > 0 ? `${wellStats.calibrationDue} need calibration` : 'All current'}
          icon={Gauge}
          color="cyan"
          onClick={() => setActiveTab('wells')}
        />
        <MetricCard
          title="YTD Extraction"
          value={`${formatNumber(wellStats.ytdExtraction)} AF`}
          subtitle={`${formatNumber(wellStats.allocationUsed)}% of allocation`}
          icon={TrendingUp}
          color={wellStats.allocationUsed > 80 ? 'red' : 'green'}
        />
        <MetricCard
          title="Allocation Left"
          value={`${formatNumber(wellStats.allocationRemaining)} AF`}
          subtitle="Remaining this year"
          icon={Waves}
          color="purple"
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <QuickActionButton icon={Sprout} label="Record Irrigation" onClick={() => setActiveTab('irrigation')} color="green" />
          <QuickActionButton icon={Plus} label="Add Zone" onClick={() => setActiveTab('irrigation')} color="green" />
          <QuickActionButton icon={Plus} label="Add Well" onClick={() => openWellSourceModal()} color="cyan" />
          <QuickActionButton icon={Gauge} label="Batch Readings" onClick={() => {
            if (wells.length > 0) openBatchReadingModal(wells);
            else toast.info('Add wells first to record readings');
          }} color="cyan" />
          <QuickActionButton icon={Gauge} label="Single Reading" onClick={() => {
            if (wells.length > 0) openWellReadingModal(wells[0].id, wells[0].well_name);
            else toast.info('Add a well first to record readings');
          }} color="blue" />
          <QuickActionButton icon={FileText} label="Add Water Test" onClick={() => {
            if (waterSources.length > 0) openWaterTestModal(null, waterSources[0]);
            else toast.info('Add a water source first');
          }} color="blue" />
        </div>
      </div>

      {/* Bottom Section: Sources & SGMA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Source Type Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Water Sources by Type</h3>
          <div className="space-y-3">
            {Object.entries(SOURCE_TYPE_LABELS).map(([type, label]) => {
              const count = waterSources.filter(s => s.source_type === type).length;
              const percentage = sourceStats.total > 0 ? (count / sourceStats.total) * 100 : 0;
              if (count === 0) return null;

              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{count}</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${type === 'well' ? 'bg-cyan-500' : type === 'municipal' ? 'bg-blue-500' : type === 'surface' ? 'bg-emerald-500' : 'bg-gray-400'}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => setActiveTab('sources')}
            className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            View all sources
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* SGMA Compliance */}
        {sgmaDashboard && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">SGMA Compliance</h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Allocation Usage</span>
                  <span className={`text-sm font-semibold ${wellStats.allocationUsed > 80 ? 'text-red-600' : 'text-primary'}`}>
                    {formatNumber(wellStats.allocationUsed)}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${wellStats.allocationUsed > 95 ? 'bg-red-500' : wellStats.allocationUsed > 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(wellStats.allocationUsed, 100)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Water Year</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{sgmaDashboard.water_year}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Current Period</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{sgmaDashboard.current_period}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <CheckCircle className="w-4 h-4" />
                  <span>Next report: {sgmaDashboard.next_report_due ? new Date(sgmaDashboard.next_report_due).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('reports')}
              className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              View full report
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OverviewTab;
