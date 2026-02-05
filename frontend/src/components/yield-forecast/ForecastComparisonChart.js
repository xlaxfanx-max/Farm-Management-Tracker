// =============================================================================
// FORECAST COMPARISON CHART
// =============================================================================
// Shows predicted vs actual yield across multiple seasons for accuracy tracking.

import React, { useState, useEffect } from 'react';
import { yieldForecastAPI } from '../../services/api';
import {
  LoadingState,
  ErrorState,
  SectionCard,
  formatNumber,
} from '../analytics/analyticsShared';

const ForecastComparisonChart = ({ cropCategory }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = {};
        if (cropCategory) params.crop_category = cropCategory;
        const response = await yieldForecastAPI.getSeasonComparison(params);
        setData(response.data);
      } catch (err) {
        setError('Failed to load comparison data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [cropCategory]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  const seasons = data?.seasons || [];
  if (seasons.length === 0) {
    return (
      <SectionCard title="Forecast vs Actual">
        <p className="text-gray-500 text-sm">
          No completed seasons with both forecasts and actuals available yet.
          Accuracy tracking will appear here after harvests are completed and backfilled.
        </p>
      </SectionCard>
    );
  }

  const maxYield = Math.max(
    ...seasons.map(s => Math.max(s.avg_predicted_yield_per_acre, s.avg_actual_yield_per_acre))
  );

  return (
    <SectionCard title="Forecast Accuracy by Season">
      <div className="space-y-4">
        {seasons.map((s) => {
          const predictedPct = (s.avg_predicted_yield_per_acre / maxYield) * 100;
          const actualPct = (s.avg_actual_yield_per_acre / maxYield) * 100;

          return (
            <div key={s.season_label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">{s.season_label}</span>
                <span className="text-gray-500">
                  {s.forecasts_count} fields - {s.avg_accuracy_pct.toFixed(1)}% accuracy
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-16">Predicted</span>
                  <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded"
                      style={{ width: `${predictedPct}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium w-16 text-right">
                    {formatNumber(s.avg_predicted_yield_per_acre, 1)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-16">Actual</span>
                  <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                    <div
                      className="h-full bg-green-400 rounded"
                      style={{ width: `${actualPct}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium w-16 text-right">
                    {formatNumber(s.avg_actual_yield_per_acre, 1)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Legend */}
        <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-400 rounded" />
            <span className="text-xs text-gray-500">Predicted</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-400 rounded" />
            <span className="text-xs text-gray-500">Actual</span>
          </div>
        </div>
      </div>
    </SectionCard>
  );
};

export default ForecastComparisonChart;
