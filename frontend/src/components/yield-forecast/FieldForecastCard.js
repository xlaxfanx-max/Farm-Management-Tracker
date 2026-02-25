// =============================================================================
// FIELD FORECAST CARD (Detail View)
// =============================================================================
// Detailed forecast view for a single field, showing CI visualization,
// historical yield trend, feature snapshot, and data quality indicators.

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, TrendingUp, BarChart3, Thermometer, Droplets,
  TreePine, Leaf, AlertCircle, CheckCircle, Info,
} from 'lucide-react';
import { yieldForecastAPI } from '../../services/api';
import {
  LoadingState,
  ErrorState,
  SectionCard,
  formatNumber,
} from '../analytics/analyticsShared';
import FeatureImportancePanel from './FeatureImportancePanel';

const ConfidenceBar = ({ lower, predicted, upper, unit, actual }) => {
  // Compute bar positions as percentages
  const min = Math.max(0, parseFloat(lower) * 0.8);
  const max = parseFloat(upper) * 1.2;
  const range = max - min || 1;

  const lowerPct = ((parseFloat(lower) - min) / range) * 100;
  const predictedPct = ((parseFloat(predicted) - min) / range) * 100;
  const upperPct = ((parseFloat(upper) - min) / range) * 100;
  const actualPct = actual ? ((parseFloat(actual) - min) / range) * 100 : null;

  return (
    <div className="space-y-2">
      <div className="relative h-12 bg-gray-100 rounded-lg overflow-hidden">
        {/* CI band */}
        <div
          className="absolute top-2 bottom-2 bg-blue-100 rounded"
          style={{ left: `${lowerPct}%`, width: `${upperPct - lowerPct}%` }}
        />
        {/* Predicted marker */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-blue-600 z-10"
          style={{ left: `${predictedPct}%` }}
        />
        {/* Actual marker */}
        {actualPct !== null && (
          <div
            className="absolute top-0 bottom-0 w-1 bg-primary z-20"
            style={{ left: `${actualPct}%` }}
          />
        )}
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{formatNumber(parseFloat(lower), 0)} {unit}</span>
        <span className="font-semibold text-blue-600">
          {formatNumber(parseFloat(predicted), 1)} {unit}/acre (predicted)
        </span>
        <span>{formatNumber(parseFloat(upper), 0)} {unit}</span>
      </div>
      {actual && (
        <div className="text-center text-sm">
          <span className="text-primary font-medium">
            Actual: {formatNumber(parseFloat(actual), 1)} {unit}/acre
          </span>
        </div>
      )}
    </div>
  );
};

const HistoricalYieldChart = ({ yields }) => {
  if (!yields || yields.length === 0) return null;

  const maxYield = Math.max(...yields.map(y => parseFloat(y.yield_per_acre)));

  return (
    <div className="space-y-2">
      {yields.map((y) => {
        const pct = (parseFloat(y.yield_per_acre) / maxYield) * 100;
        const classColor = y.classification === 'on'
          ? 'bg-green-500'
          : y.classification === 'off'
          ? 'bg-red-400'
          : 'bg-blue-400';

        return (
          <div key={y.season} className="flex items-center gap-3">
            <span className="text-sm text-gray-600 w-24 text-right">{y.season}</span>
            <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
              <div
                className={`h-full ${classColor} rounded transition-all`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-sm font-medium w-20 text-right">
              {formatNumber(parseFloat(y.yield_per_acre), 1)}
            </span>
            {y.classification && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                y.classification === 'on' ? 'bg-green-100 text-primary' :
                y.classification === 'off' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {y.classification}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

const FeatureHighlight = ({ icon: Icon, label, value, unit, status }) => {
  const statusColors = {
    good: 'text-primary',
    warning: 'text-yellow-600',
    missing: 'text-gray-400',
  };

  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className={`w-5 h-5 ${statusColors[status] || 'text-gray-400'}`} />
      <div className="flex-1">
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <span className={`text-sm font-medium ${
        status === 'missing' ? 'text-gray-400 italic' : 'text-gray-900'
      }`}>
        {status === 'missing' ? 'No data' : `${value}${unit ? ` ${unit}` : ''}`}
      </span>
    </div>
  );
};

const FieldForecastCard = ({ fieldId, seasonLabel, onBack }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadDetail = async () => {
      setLoading(true);
      try {
        const params = {};
        if (seasonLabel) params.season_label = seasonLabel;
        const response = await yieldForecastAPI.getFieldDetail(fieldId, params);
        setData(response.data);
      } catch (err) {
        console.error('Error loading field forecast detail:', err);
        setError('Failed to load forecast details');
      } finally {
        setLoading(false);
      }
    };
    loadDetail();
  }, [fieldId, seasonLabel]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  if (!data) return null;

  const { field, current_forecast, feature_snapshot, historical_yields, season_forecasts } = data;
  const forecast = current_forecast;
  const snapshot = feature_snapshot;

  // Build data improvement suggestions
  const suggestions = [];
  if (snapshot) {
    const q = snapshot.data_quality || {};
    if (!q.tree_age_years) suggestions.push('Add planting date to your field for tree age tracking');
    if (!q.gdd_cumulative) suggestions.push('Configure CIMIS station on your farm for climate data');
    if (!q.ndvi_mean) suggestions.push('Upload satellite imagery for NDVI vegetation analysis');
    if (!q.soil_awc) suggestions.push('Run soil data sync to fetch SSURGO properties');
    if (!q.irrigation_applied_in) suggestions.push('Log irrigation events for water input tracking');
    if (!q.alternate_bearing_index) suggestions.push('Need 3+ seasons of harvest data for bearing analysis');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{field.name}</h2>
          <p className="text-gray-600">
            {field.farm_name} - {field.crop_name} - {field.total_acres} acres
            {field.tree_age_years ? ` - ${field.tree_age_years} yr old trees` : ''}
          </p>
        </div>
      </div>

      {/* Main Forecast */}
      {forecast ? (
        <SectionCard title="Current Forecast">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-500">Predicted Yield/Acre</p>
                <p className="text-3xl font-bold text-blue-600">
                  {formatNumber(parseFloat(forecast.predicted_yield_per_acre), 1)}
                </p>
                <p className="text-sm text-gray-500">{forecast.yield_unit}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Predicted</p>
                <p className="text-3xl font-bold text-gray-900">
                  {formatNumber(parseFloat(forecast.predicted_total_yield), 0)}
                </p>
                <p className="text-sm text-gray-500">
                  {forecast.yield_unit} ({forecast.harvestable_acres} acres)
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Method</p>
                <p className="text-lg font-semibold text-gray-700">
                  {forecast.forecast_method_display}
                </p>
                <p className="text-sm text-gray-500">
                  {forecast.data_completeness_pct
                    ? `${parseFloat(forecast.data_completeness_pct).toFixed(0)}% data`
                    : ''}
                </p>
              </div>
            </div>

            {/* Confidence Interval Bar */}
            <ConfidenceBar
              lower={forecast.lower_bound_per_acre}
              predicted={forecast.predicted_yield_per_acre}
              upper={forecast.upper_bound_per_acre}
              unit={forecast.yield_unit}
              actual={forecast.actual_yield_per_acre}
            />

            {/* Degradation Warnings */}
            {forecast.degradation_warnings && forecast.degradation_warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">Data Limitations</span>
                </div>
                <ul className="text-sm text-yellow-700 space-y-1 ml-6">
                  {forecast.degradation_warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="Current Forecast">
          <p className="text-gray-500">No forecast generated for this field yet.</p>
        </SectionCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Historical Yields */}
        <SectionCard title="Historical Yield Trend">
          {historical_yields && historical_yields.length > 0 ? (
            <HistoricalYieldChart yields={historical_yields} />
          ) : (
            <p className="text-gray-500 text-sm">No historical yield data available.</p>
          )}
        </SectionCard>

        {/* Key Features */}
        <SectionCard title="Feature Snapshot">
          {snapshot ? (
            <div className="divide-y divide-gray-100">
              <FeatureHighlight
                icon={Thermometer}
                label="Growing Degree Days"
                value={snapshot.gdd_cumulative ? formatNumber(parseFloat(snapshot.gdd_cumulative), 0) : null}
                unit="GDD"
                status={snapshot.gdd_cumulative ? 'good' : 'missing'}
              />
              <FeatureHighlight
                icon={Thermometer}
                label="Chill Hours"
                value={snapshot.chill_hours_cumulative ? formatNumber(parseFloat(snapshot.chill_hours_cumulative), 0) : null}
                unit="hrs"
                status={snapshot.chill_hours_cumulative ? 'good' : 'missing'}
              />
              <FeatureHighlight
                icon={Droplets}
                label="Precipitation"
                value={snapshot.precipitation_cumulative_in ? formatNumber(parseFloat(snapshot.precipitation_cumulative_in), 1) : null}
                unit="in"
                status={snapshot.precipitation_cumulative_in ? 'good' : 'missing'}
              />
              <FeatureHighlight
                icon={Leaf}
                label="NDVI (Vegetation Health)"
                value={snapshot.ndvi_mean ? parseFloat(snapshot.ndvi_mean).toFixed(3) : null}
                status={snapshot.ndvi_mean ? 'good' : 'missing'}
              />
              <FeatureHighlight
                icon={TreePine}
                label="Canopy Coverage"
                value={snapshot.canopy_coverage_pct ? `${parseFloat(snapshot.canopy_coverage_pct).toFixed(1)}%` : null}
                status={snapshot.canopy_coverage_pct ? 'good' : 'missing'}
              />
              <FeatureHighlight
                icon={BarChart3}
                label="Bearing Index"
                value={snapshot.alternate_bearing_index ? parseFloat(snapshot.alternate_bearing_index).toFixed(3) : null}
                status={snapshot.alternate_bearing_index ? 'good' : 'missing'}
              />
              <FeatureHighlight
                icon={Droplets}
                label="Irrigation Applied"
                value={snapshot.irrigation_applied_in ? formatNumber(parseFloat(snapshot.irrigation_applied_in), 1) : null}
                unit="in"
                status={snapshot.irrigation_applied_in ? 'good' : 'missing'}
              />
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No feature data computed yet.</p>
          )}
        </SectionCard>
      </div>

      {/* Feature Importance */}
      {forecast && forecast.feature_importance && Object.keys(forecast.feature_importance).length > 0 && (
        <FeatureImportancePanel importance={forecast.feature_importance} />
      )}

      {/* Data Improvement Suggestions */}
      {suggestions.length > 0 && (
        <SectionCard title="Improve Your Forecast">
          <div className="space-y-2">
            <p className="text-sm text-gray-600 mb-3">
              Add more data to narrow the confidence interval and improve accuracy:
            </p>
            {suggestions.map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">{s}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Season Forecast History */}
      {season_forecasts && season_forecasts.length > 0 && (
        <SectionCard title="Forecast History">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase py-2">Season</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase py-2">Predicted</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase py-2">Actual</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase py-2">Error</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase py-2">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {season_forecasts.map((sf) => (
                  <tr key={sf.season_label}>
                    <td className="py-2 text-sm font-medium">{sf.season_label}</td>
                    <td className="py-2 text-sm text-right">
                      {formatNumber(parseFloat(sf.predicted_yield_per_acre), 1)}
                    </td>
                    <td className="py-2 text-sm text-right">
                      {sf.actual_yield_per_acre
                        ? formatNumber(parseFloat(sf.actual_yield_per_acre), 1)
                        : '-'}
                    </td>
                    <td className="py-2 text-sm text-right">
                      {sf.forecast_error_pct
                        ? `${parseFloat(sf.forecast_error_pct).toFixed(1)}%`
                        : '-'}
                    </td>
                    <td className="py-2 text-sm">{sf.forecast_method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
};

export default FieldForecastCard;
