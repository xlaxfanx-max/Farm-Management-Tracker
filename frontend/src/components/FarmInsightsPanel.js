import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, MapPin, Sprout, Droplets, FileText, BarChart3 } from 'lucide-react';

/**
 * FarmInsightsPanel component - Displays aggregated insights across all farms
 *
 * @param {Object} props
 * @param {Array} props.farms - Array of all farms
 * @param {Array} props.fields - Array of all fields
 * @param {Array} props.applications - Array of all applications
 * @param {Array} props.waterSources - Array of all water sources (optional)
 */
function FarmInsightsPanel({ farms = [], fields = [], applications = [], waterSources = [] }) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Calculate aggregated statistics
  const insights = useMemo(() => {
    const totalFarms = farms.length;
    const mappedFarms = farms.filter(f => f.gps_latitude && f.gps_longitude).length;

    const totalFields = fields.length;
    const mappedFields = fields.filter(f => f.boundary_geojson).length;
    const totalAcres = fields.reduce((sum, f) => sum + (parseFloat(f.total_acres) || 0), 0);

    // Crop distribution
    const cropAcres = {};
    fields.forEach(f => {
      const crop = f.crop_name || f.current_crop || 'Unknown';
      cropAcres[crop] = (cropAcres[crop] || 0) + (parseFloat(f.total_acres) || 0);
    });
    const topCrops = Object.entries(cropAcres)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    // County distribution
    const countyCount = {};
    farms.forEach(f => {
      if (f.county) {
        countyCount[f.county] = (countyCount[f.county] || 0) + 1;
      }
    });
    const topCounties = Object.entries(countyCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    // Application stats
    const totalApplications = applications.length;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentApplications = applications.filter(a =>
      new Date(a.application_date) >= thirtyDaysAgo
    ).length;

    // Water sources
    const activeWaterSources = waterSources.filter(ws => ws.active).length;

    return {
      totalFarms,
      mappedFarms,
      farmCoverage: totalFarms > 0 ? Math.round((mappedFarms / totalFarms) * 100) : 0,
      totalFields,
      mappedFields,
      fieldCoverage: totalFields > 0 ? Math.round((mappedFields / totalFields) * 100) : 0,
      totalAcres,
      topCrops,
      topCounties,
      totalApplications,
      recentApplications,
      activeWaterSources
    };
  }, [farms, fields, applications, waterSources]);

  if (farms.length === 0) {
    return null;
  }

  return (
    <div className="bg-surface-raised rounded-card border border-border overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-cream-100 hover:from-green-100 hover:to-orange-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className=" text-heading">Farm Insights</h3>
          <span className="text-sm text-text-secondary">
            {insights.totalAcres.toFixed(0)} total acres across {insights.totalFarms} farms
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-text-muted" />
        ) : (
          <ChevronDown className="w-5 h-5 text-text-muted" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {/* Total Acreage */}
            <div className="bg-cream-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Sprout className="w-4 h-4 text-primary" />
                <span className="text-xs text-text-secondary uppercase tracking-wide">Total Acres</span>
              </div>
              <p className="text-2xl font-bold text-heading">{insights.totalAcres.toFixed(0)}</p>
            </div>

            {/* Farm Coverage */}
            <div className="bg-cream-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-link" />
                <span className="text-xs text-text-secondary uppercase tracking-wide">Farm Coverage</span>
              </div>
              <p className="text-2xl font-bold text-heading">
                {insights.farmCoverage}%
                <span className="text-sm font-normal text-text-secondary ml-1">
                  ({insights.mappedFarms}/{insights.totalFarms})
                </span>
              </p>
            </div>

            {/* Field Coverage */}
            <div className="bg-cream-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-xs text-text-secondary uppercase tracking-wide">Field Coverage</span>
              </div>
              <p className="text-2xl font-bold text-heading">
                {insights.fieldCoverage}%
                <span className="text-sm font-normal text-text-secondary ml-1">
                  ({insights.mappedFields}/{insights.totalFields})
                </span>
              </p>
            </div>

            {/* Applications */}
            <div className="bg-cream-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-bark-700" />
                <span className="text-xs text-text-secondary uppercase tracking-wide">Applications</span>
              </div>
              <p className="text-2xl font-bold text-heading">
                {insights.totalApplications}
                <span className="text-sm font-normal text-text-secondary ml-1">
                  ({insights.recentApplications} this month)
                </span>
              </p>
            </div>

            {/* Water Sources */}
            {insights.activeWaterSources > 0 && (
              <div className="bg-cream-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Droplets className="w-4 h-4 text-orange-500" />
                  <span className="text-xs text-text-secondary uppercase tracking-wide">Water Sources</span>
                </div>
                <p className="text-2xl font-bold text-heading">{insights.activeWaterSources}</p>
              </div>
            )}

            {/* Top Crops */}
            {insights.topCrops.length > 0 && (
              <div className="bg-cream-50 rounded-lg p-3 col-span-2 md:col-span-1">
                <div className="flex items-center gap-2 mb-1">
                  <Sprout className="w-4 h-4 text-yellow-600" />
                  <span className="text-xs text-text-secondary uppercase tracking-wide">Top Crops</span>
                </div>
                <div className="space-y-1">
                  {insights.topCrops.map(([crop, acres], idx) => (
                    <div key={crop} className="flex items-center justify-between text-sm">
                      <span className={`${idx === 0 ? 'font-semibold text-heading' : 'text-bark-600'}`}>
                        {crop}
                      </span>
                      <span className="text-text-secondary">{acres.toFixed(0)} ac</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* County Distribution */}
          {insights.topCounties.length > 1 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-text-secondary uppercase tracking-wide mb-2">Counties</p>
              <div className="flex flex-wrap gap-2">
                {insights.topCounties.map(([county, count]) => (
                  <span
                    key={county}
                    className="px-3 py-1 bg-cream-100 text-bark-700 rounded-full text-sm"
                  >
                    {county} <span className="text-text-muted">({count})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Coverage Progress Bars */}
          {(insights.farmCoverage < 100 || insights.fieldCoverage < 100) && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-text-secondary uppercase tracking-wide mb-3">Mapping Progress</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Farm Mapping Progress */}
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-bark-600">Farms with GPS</span>
                    <span className="font-medium">{insights.farmCoverage}%</span>
                  </div>
                  <div className="h-2 bg-sand-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        insights.farmCoverage === 100 ? 'bg-green-500' : 'bg-primary'
                      }`}
                      style={{ width: `${insights.farmCoverage}%` }}
                    />
                  </div>
                </div>

                {/* Field Mapping Progress */}
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-bark-600">Fields with boundaries</span>
                    <span className="font-medium">{insights.fieldCoverage}%</span>
                  </div>
                  <div className="h-2 bg-sand-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        insights.fieldCoverage === 100 ? 'bg-green-500' : 'bg-green-400'
                      }`}
                      style={{ width: `${insights.fieldCoverage}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default React.memo(FarmInsightsPanel);
