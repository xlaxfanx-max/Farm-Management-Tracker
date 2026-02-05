// =============================================================================
// FEATURE IMPORTANCE PANEL
// =============================================================================
// Displays which features drove the yield forecast, with horizontal bar chart
// showing relative importance. Color-coded for positive/negative influence.

import React from 'react';
import { SectionCard } from '../analytics/analyticsShared';

const FEATURE_LABELS = {
  historical_mean: 'Historical Average',
  alternate_bearing: 'Alternate Bearing Pattern',
  climate_adjustment: 'Climate Conditions',
  heat_stress: 'Heat Stress Impact',
  frost_events: 'Frost Events Impact',
  gdd_deviation: 'Growing Degree Days',
  chill_deviation: 'Chill Hours',
  precip_deviation: 'Precipitation',
  crop_baseline: 'Crop Baseline',
};

const FeatureImportancePanel = ({ importance }) => {
  if (!importance || Object.keys(importance).length === 0) return null;

  // Sort features by absolute importance
  const sortedFeatures = Object.entries(importance)
    .map(([key, value]) => ({
      key,
      label: FEATURE_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: parseFloat(value),
    }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  const maxValue = Math.max(...sortedFeatures.map(f => Math.abs(f.value)), 0.01);

  return (
    <SectionCard title="What's Driving This Forecast">
      <div className="space-y-3">
        {sortedFeatures.map((feature) => {
          const pct = (Math.abs(feature.value) / maxValue) * 100;
          const isPositive = feature.value >= 0;

          return (
            <div key={feature.key} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{feature.label}</span>
                <span className={`text-sm font-medium ${
                  isPositive ? 'text-green-600' : 'text-red-600'
                }`}>
                  {isPositive ? '+' : ''}{(feature.value * 100).toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isPositive ? 'bg-green-400' : 'bg-red-400'
                  }`}
                  style={{ width: `${Math.max(pct, 3)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-400 mt-4">
        Positive values increase the forecast; negative values decrease it relative to the historical average.
      </p>
    </SectionCard>
  );
};

export default FeatureImportancePanel;
