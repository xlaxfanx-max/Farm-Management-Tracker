import React, { useState } from 'react';
import {
  Droplet,
  Clock,
  Settings,
  MoreVertical,
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Calendar,
  TrendingUp,
  Satellite,
  Leaf,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';

function IrrigationZoneCard({ zone, onEdit, onRecordIrrigation, variant = 'normal' }) {
  const [showSatelliteDetails, setShowSatelliteDetails] = useState(false);

  const getStatusColor = () => {
    if (variant === 'urgent' || zone.status === 'needs_irrigation') {
      return {
        bg: 'bg-red-50',
        border: 'border-red-200',
        badge: 'bg-red-100 text-red-700',
        icon: AlertTriangle,
        iconColor: 'text-red-500'
      };
    }
    if (variant === 'warning' || zone.status === 'irrigation_soon') {
      return {
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        badge: 'bg-orange-100 text-orange-700',
        icon: Clock,
        iconColor: 'text-orange-500'
      };
    }
    return {
      bg: 'bg-white',
      border: 'border-gray-200',
      badge: 'bg-green-100 text-green-700',
      icon: CheckCircle2,
      iconColor: 'text-green-500'
    };
  };

  const colors = getStatusColor();
  const StatusIcon = colors.icon;

  // Get depletion bar width and color
  const depletionPct = zone.depletion_pct || 0;
  const getDepletionColor = () => {
    if (depletionPct >= 70) return 'bg-red-500';
    if (depletionPct >= 50) return 'bg-orange-500';
    if (depletionPct >= 30) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg} p-4 hover:shadow-md transition-shadow`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{zone.zone_name || zone.name}</h3>
          <p className="text-sm text-gray-500">
            {zone.field_name} {zone.farm_name ? `- ${zone.farm_name}` : ''}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colors.badge}`}>
            <StatusIcon className={`w-3 h-3 mr-1 ${colors.iconColor}`} />
            {zone.status_label || zone.status || 'OK'}
          </span>
        </div>
      </div>

      {/* Depletion Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-600">Soil Depletion</span>
          <span className="font-medium text-gray-900">{depletionPct.toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${getDepletionColor()} transition-all duration-300`}
            style={{ width: `${Math.min(depletionPct, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>Field Capacity</span>
          <span>MAD: {zone.mad_pct || 50}%</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white bg-opacity-50 rounded-lg p-2">
          <div className="flex items-center text-xs text-gray-500 mb-1">
            <Gauge className="w-3 h-3 mr-1" />
            Days to MAD
          </div>
          <p className="font-semibold text-gray-900">
            {zone.days_to_depletion !== undefined ? zone.days_to_depletion : '-'}
          </p>
        </div>
        <div className="bg-white bg-opacity-50 rounded-lg p-2">
          <div className="flex items-center text-xs text-gray-500 mb-1">
            <Calendar className="w-3 h-3 mr-1" />
            Last Irrigated
          </div>
          <p className="font-semibold text-gray-900">
            {zone.days_since_irrigation !== undefined
              ? `${zone.days_since_irrigation} days ago`
              : '-'}
          </p>
        </div>
      </div>

      {/* Recommendation if present */}
      {zone.recommendation && zone.recommendation.needed && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-4">
          <p className="text-xs text-blue-600 font-medium mb-1">Recommended Irrigation</p>
          <p className="text-sm text-blue-900">
            {zone.recommendation.depth_inches?.toFixed(2)}" ({zone.recommendation.hours?.toFixed(1)} hrs)
          </p>
        </div>
      )}

      {/* Zone Info */}
      <div className="text-xs text-gray-500 space-y-1 mb-4">
        <div className="flex justify-between">
          <span>Crop:</span>
          <span className="text-gray-700">{zone.crop_type || 'Not set'}</span>
        </div>
        <div className="flex justify-between">
          <span>Method:</span>
          <span className="text-gray-700">{zone.irrigation_method || 'Not set'}</span>
        </div>
        <div className="flex justify-between">
          <span>Acres:</span>
          <span className="text-gray-700">{zone.acres ? Number(zone.acres).toFixed(1) : '0'}</span>
        </div>
      </div>

      {/* Satellite Adjustment Section */}
      {zone.details?.satellite_adjustment && (
        <div className="mb-4">
          <button
            onClick={() => setShowSatelliteDetails(!showSatelliteDetails)}
            className="w-full flex items-center justify-between text-xs text-gray-600 hover:text-gray-800 py-1"
          >
            <div className="flex items-center">
              <Satellite className="w-3 h-3 mr-1" />
              <span className="font-medium">Satellite Data</span>
              {zone.details.satellite_adjustment.satellite_data_used ? (
                <span className="ml-2 px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                  Active
                </span>
              ) : (
                <span className="ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                  Not Available
                </span>
              )}
            </div>
            {showSatelliteDetails ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>

          {showSatelliteDetails && zone.details.satellite_adjustment.satellite_data_used && (
            <div className="mt-2 p-3 bg-gradient-to-br from-blue-50 to-green-50 rounded-lg border border-blue-100">
              {/* Kc Adjustment Summary */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-600">Kc Adjustment</span>
                <div className="text-right">
                  <span className="text-xs text-gray-400 line-through mr-1">
                    {zone.details.satellite_adjustment.base_kc?.toFixed(2)}
                  </span>
                  <span className="text-sm font-semibold text-blue-700">
                    {zone.details.satellite_adjustment.adjusted_kc?.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Canopy Coverage */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-white bg-opacity-60 rounded p-2">
                  <div className="flex items-center text-xs text-gray-500 mb-1">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    Canopy Coverage
                  </div>
                  <p className="text-sm font-medium text-gray-800">
                    {zone.details.satellite_adjustment.canopy_coverage_percent?.toFixed(0)}%
                    <span className="text-xs text-gray-400 ml-1">
                      / {zone.details.satellite_adjustment.reference_coverage_percent?.toFixed(0)}% ref
                    </span>
                  </p>
                </div>
                <div className="bg-white bg-opacity-60 rounded p-2">
                  <div className="flex items-center text-xs text-gray-500 mb-1">
                    <Leaf className="w-3 h-3 mr-1" />
                    Avg NDVI
                  </div>
                  <p className="text-sm font-medium text-gray-800">
                    {zone.details.satellite_adjustment.zone_avg_ndvi?.toFixed(2) || 'N/A'}
                    {zone.details.satellite_adjustment.zone_avg_ndvi && (
                      <span className={`text-xs ml-1 ${
                        zone.details.satellite_adjustment.zone_avg_ndvi >= 0.75 ? 'text-green-600' :
                        zone.details.satellite_adjustment.zone_avg_ndvi >= 0.65 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {zone.details.satellite_adjustment.zone_avg_ndvi >= 0.75 ? '(Healthy)' :
                         zone.details.satellite_adjustment.zone_avg_ndvi >= 0.65 ? '(Mild Stress)' :
                         '(Stressed)'}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Adjustment Factors */}
              <div className="flex items-center space-x-4 text-xs mb-3">
                <div>
                  <span className="text-gray-500">Canopy Factor:</span>
                  <span className="ml-1 font-medium text-gray-700">
                    {zone.details.satellite_adjustment.canopy_factor?.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Health Modifier:</span>
                  <span className="ml-1 font-medium text-gray-700">
                    {zone.details.satellite_adjustment.health_modifier?.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Data Freshness */}
              <div className="flex items-center justify-between text-xs border-t border-blue-100 pt-2">
                <span className="text-gray-500">
                  Detection: {zone.details.satellite_adjustment.detection_date || 'Unknown'}
                </span>
                <span className={`px-1.5 py-0.5 rounded ${
                  zone.details.satellite_adjustment.data_freshness === 'current'
                    ? 'bg-green-100 text-green-700'
                    : zone.details.satellite_adjustment.data_freshness === 'stale'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {zone.details.satellite_adjustment.data_freshness || 'Unknown'}
                </span>
              </div>

              {/* Adjustments Applied */}
              {zone.details.satellite_adjustment.adjustments_applied?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-blue-100">
                  <div className="flex items-start text-xs text-gray-600">
                    <Info className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      {zone.details.satellite_adjustment.adjustments_applied.map((adj, idx) => (
                        <p key={idx}>{adj}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {showSatelliteDetails && !zone.details.satellite_adjustment.satellite_data_used && (
            <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-500">
              <p>No satellite data available for this zone's field.</p>
              <p className="mt-1">Run tree detection on satellite imagery to enable Kc adjustments.</p>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center space-x-2 pt-3 border-t border-gray-200">
        <button
          onClick={onRecordIrrigation}
          className="flex-1 flex items-center justify-center px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Droplet className="w-4 h-4 mr-1" />
          Record Irrigation
        </button>
        <button
          onClick={onEdit}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Zone Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default IrrigationZoneCard;
