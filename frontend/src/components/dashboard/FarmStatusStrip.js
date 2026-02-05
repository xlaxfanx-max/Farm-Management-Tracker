import React from 'react';
import { MapPin, Sprout, Droplets, AlertTriangle } from 'lucide-react';
import { StatusDot } from '../ui/StatusBadge';

/**
 * Horizontal strip showing status of each farm - provides quick overview
 */
function FarmStatusStrip({ farms = [], fields = [], applications = [], waterSources = [], onFarmClick }) {
  // Calculate status for each farm
  const getFarmStatus = (farm) => {
    const farmFields = fields.filter(f => f.farm === farm.id);
    const farmApplications = applications.filter(a => {
      const field = fields.find(f => f.id === a.field);
      return field && field.farm === farm.id;
    });
    const farmWaterSources = waterSources.filter(ws => ws.farm === farm.id);

    const pendingSignatures = farmApplications.filter(a => a.status === 'pending_signature').length;
    const activeFields = farmFields.filter(f => f.active).length;
    const totalAcres = farmFields.reduce((sum, f) => sum + (parseFloat(f.total_acres) || 0), 0);

    // Determine health status
    let health = 'healthy';
    let alerts = [];

    if (pendingSignatures > 0) {
      health = 'attention';
      alerts.push(`${pendingSignatures} pending signature${pendingSignatures > 1 ? 's' : ''}`);
    }

    // Could add more health checks here (overdue water tests, etc.)

    return {
      farm,
      fieldCount: farmFields.length,
      activeFields,
      totalAcres: totalAcres.toFixed(1),
      pendingSignatures,
      waterSourceCount: farmWaterSources.length,
      health,
      alerts
    };
  };

  const farmStatuses = farms.map(getFarmStatus);

  if (farms.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <p className="text-sm text-gray-500 text-center">No farms yet. Add your first farm to get started.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <MapPin className="w-4 h-4" />
        Farm Overview
      </h3>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {farmStatuses.map(({ farm, fieldCount, activeFields, totalAcres, pendingSignatures, waterSourceCount, health, alerts }) => (
          <div
            key={farm.id}
            onClick={() => onFarmClick?.(farm)}
            className={`
              flex-shrink-0 min-w-[180px] p-3 rounded-lg border-2 cursor-pointer
              transition-all hover:shadow-md
              ${health === 'healthy' ? 'border-green-200 bg-green-50/50 hover:border-green-300' : ''}
              ${health === 'attention' ? 'border-amber-200 bg-amber-50/50 hover:border-amber-300' : ''}
              ${health === 'critical' ? 'border-red-200 bg-red-50/50 hover:border-red-300' : ''}
            `}
          >
            {/* Farm Name & Status */}
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900 text-sm truncate flex-1">{farm.name}</h4>
              <StatusDot status={health} size="md" className="ml-2 flex-shrink-0" />
            </div>

            {/* Quick Stats */}
            <div className="space-y-1 text-xs text-gray-600">
              <div className="flex items-center gap-1.5">
                <Sprout className="w-3 h-3 text-green-500" />
                <span>{activeFields} field{activeFields !== 1 ? 's' : ''}</span>
                <span className="text-gray-400">·</span>
                <span>{totalAcres} ac</span>
              </div>
              {waterSourceCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <Droplets className="w-3 h-3 text-blue-500" />
                  <span>{waterSourceCount} water source{waterSourceCount !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>

            {/* Alerts */}
            {alerts.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                {alerts.map((alert, idx) => (
                  <div key={idx} className="flex items-center gap-1 text-xs text-amber-600">
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
