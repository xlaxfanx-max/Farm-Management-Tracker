import React from 'react';
import { MapPin, Sprout, Droplets, AlertTriangle } from 'lucide-react';
import { StatusDot } from '../ui/StatusBadge';

/**
 * Horizontal strip showing status of each farm — compact overview.
 */
function FarmStatusStrip({ farms = [], fields = [], applications = [], applicationEvents = [], waterSources = [], onFarmClick }) {
  const getFarmStatus = (farm) => {
    const farmFields = fields.filter(f => f.farm === farm.id);
    const farmApplications = applications.filter(a => {
      const field = fields.find(f => f.id === a.field);
      return field && field.farm === farm.id;
    });
    const farmWaterSources = waterSources.filter(ws => ws.farm === farm.id);

    const pendingSignatures = farmApplications.filter(a => a.status === 'pending_signature').length;
    const farmEvents = applicationEvents.filter(evt => evt.farm === farm.id);
    const draftEventCount = farmEvents.filter(evt => evt.pur_status === 'draft').length;
    const activeFields = farmFields.filter(f => f.active).length;
    const totalAcres = farmFields.reduce((sum, f) => sum + (parseFloat(f.total_acres) || 0), 0);

    let health = 'healthy';
    let alerts = [];

    if (pendingSignatures > 0) {
      health = 'attention';
      alerts.push(`${pendingSignatures} pending signature${pendingSignatures > 1 ? 's' : ''}`);
    }

    if (draftEventCount > 0) {
      health = 'attention';
      alerts.push(`${draftEventCount} draft event${draftEventCount > 1 ? 's' : ''}`);
    }

    return { farm, fieldCount: farmFields.length, activeFields, totalAcres: totalAcres.toFixed(1), pendingSignatures, waterSourceCount: farmWaterSources.length, health, alerts };
  };

  const farmStatuses = farms.map(getFarmStatus);

  if (farms.length === 0) {
    return (
      <div className="bg-surface-raised dark:bg-gray-800 rounded-lg border border-border dark:border-gray-700 p-4">
        <p className="text-sm text-text-muted dark:text-gray-500 text-center">No farms yet. Add your first farm to get started.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-raised dark:bg-gray-800 rounded-lg border border-border dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-text dark:text-gray-200 mb-3 flex items-center gap-2">
        <MapPin className="w-4 h-4 text-text-secondary dark:text-gray-400" />
        Farm Overview
      </h3>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {farmStatuses.map(({ farm, activeFields, totalAcres, waterSourceCount, health, alerts }) => (
          <div
            key={farm.id}
            onClick={() => onFarmClick?.(farm)}
            className={`
              flex-shrink-0 min-w-[180px] p-3 rounded-lg border-2 cursor-pointer
              transition-all hover:shadow-md
              ${health === 'healthy' ? 'border-primary/30 bg-primary-light dark:bg-primary/5 dark:border-primary/20 hover:border-primary/50' : ''}
              ${health === 'attention' ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-800 hover:border-amber-300' : ''}
              ${health === 'critical' ? 'border-red-200 bg-red-50/50 dark:bg-red-900/10 dark:border-red-800 hover:border-red-300' : ''}
            `}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-text dark:text-gray-200 text-sm truncate flex-1">{farm.name}</h4>
              <StatusDot status={health} size="md" className="ml-2 flex-shrink-0" />
            </div>

            <div className="space-y-1 text-xs text-text-secondary dark:text-gray-400">
              <div className="flex items-center gap-1.5">
                <Sprout className="w-3 h-3 text-primary" />
                <span>{activeFields} field{activeFields !== 1 ? 's' : ''}</span>
                <span className="text-text-muted">·</span>
                <span>{totalAcres} ac</span>
              </div>
              {waterSourceCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <Droplets className="w-3 h-3 text-blue-500" />
                  <span>{waterSourceCount} water source{waterSourceCount !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>

            {alerts.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border dark:border-gray-600">
                {alerts.map((alert, idx) => (
                  <div key={idx} className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{alert}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default React.memo(FarmStatusStrip);
