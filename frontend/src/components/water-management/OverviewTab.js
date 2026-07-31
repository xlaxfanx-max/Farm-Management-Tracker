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
        <h3 className="finch-eyebrow mb-4">Quick actions</h3>
        <div className="flex flex-wrap gap-3">
          <QuickActionButton icon={Plus} label="Add well" onClick={() => openWellSourceModal()} variant="primary" />
          <QuickActionButton icon={Gauge} label="Batch readings" onClick={() => {
            if (wells.length > 0) openBatchReadingModal(wells);
            else toast.info('Add wells first to record readings');
          }} variant="secondary" />
          <QuickActionButton icon={Gauge} label="Single reading" onClick={() => {
            if (wells.length > 0) openWellReadingModal(wells[0].id, wells[0].well_name);
            else toast.info('Add a well first to record readings');
          }} variant="secondary" />
          <QuickActionButton icon={FileText} label="Add water test" onClick={() => {
            if (waterSources.length > 0) openWaterTestModal(null, waterSources[0]);
            else toast.info('Add a water source first');
          }} variant="secondary" />
        </div>
      </div>

      {/* Bottom Section: Sources & SGMA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Source Type Breakdown */}
        <div className="bg-surface-raised rounded-card border border-border p-5">
          <h3 className=" text-heading mb-4">Water Sources by Type</h3>
          <div className="space-y-3">
            {Object.entries(SOURCE_TYPE_LABELS).map(([type, label]) => {
              const count = waterSources.filter(s => s.source_type === type).length;
              const percentage = sourceStats.total > 0 ? (count / sourceStats.total) * 100 : 0;
              if (count === 0) return null;

              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-bark-700">{label}</span>
                    <span className="text-sm text-text-secondary">{count}</span>
                  </div>
                  <div className="w-full bg-cream-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${type === 'well' ? 'bg-green-500' : type === 'municipal' ? 'bg-primary' : type === 'surface' ? 'bg-green-500' : 'bg-bark-400'}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => setActiveTab('sources')}
            className="mt-4 text-sm text-link hover:text-orange-700 font-medium flex items-center gap-1"
          >
            View all sources
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* SGMA Compliance */}
        {sgmaDashboard && (
          <div className="bg-surface-raised rounded-card border border-border p-5">
            <h3 className=" text-heading mb-4">SGMA Compliance</h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-bark-600">Allocation Usage</span>
                  <span className={`text-sm font-semibold ${wellStats.allocationUsed > 80 ? 'text-danger' : 'text-primary'}`}>
                    {formatNumber(wellStats.allocationUsed)}%
                  </span>
                </div>
                <div className="w-full bg-cream-100 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${wellStats.allocationUsed > 95 ? 'bg-danger' : wellStats.allocationUsed > 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(wellStats.allocationUsed, 100)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="bg-cream-50 rounded-lg p-3">
                  <p className="text-xs text-text-secondary">Water Year</p>
                  <p className="text-lg font-semibold text-heading">{sgmaDashboard.water_year}</p>
                </div>
                <div className="bg-cream-50 rounded-lg p-3">
                  <p className="text-xs text-text-secondary">Current Period</p>
                  <p className="text-lg font-semibold text-heading">{sgmaDashboard.current_period}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2 text-sm">
                <div className="flex items-center gap-2 text-bark-600">
                  <CheckCircle className="w-4 h-4" />
                  <span>Next report: {sgmaDashboard.next_report_due ? new Date(sgmaDashboard.next_report_due).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('reports')}
              className="mt-4 text-sm text-link hover:text-orange-700 font-medium flex items-center gap-1"
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
