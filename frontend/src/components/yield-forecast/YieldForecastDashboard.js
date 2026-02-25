// =============================================================================
// YIELD FORECAST DASHBOARD
// =============================================================================
// Overview of all field-level yield forecasts with summary metrics,
// data quality indicators, and forecast generation controls.

import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, BarChart3, Wheat, Target, RefreshCw,
  ChevronRight, AlertTriangle, CheckCircle, AlertCircle,
  Filter, Download,
} from 'lucide-react';
import { yieldForecastAPI, farmsAPI } from '../../services/api';
import SeasonSelector from '../SeasonSelector';
import { useSeason } from '../../contexts/SeasonContext';
import {
  AnalyticsCard,
  LoadingState,
  ErrorState,
  EmptyState,
  SectionCard,
  formatNumber,
  tableHeaderClass,
  tableCellClass,
} from '../analytics/analyticsShared';
import FieldForecastCard from './FieldForecastCard';

const DataQualityBadge = ({ completeness }) => {
  const pct = parseFloat(completeness) || 0;
  if (pct >= 70) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-primary">
        <CheckCircle className="w-3 h-3" />
        Good
      </span>
    );
  } else if (pct >= 40) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
        <AlertCircle className="w-3 h-3" />
        Fair
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
      <AlertTriangle className="w-3 h-3" />
      Low
    </span>
  );
};

const MethodBadge = ({ method }) => {
  const colors = {
    climate_adjusted: 'bg-blue-100 text-blue-700',
    bearing_adjusted: 'bg-purple-100 text-purple-700',
    historical_avg: 'bg-gray-100 text-gray-700',
    crop_baseline: 'bg-orange-100 text-orange-700',
  };
  const labels = {
    climate_adjusted: 'Climate-Adjusted',
    bearing_adjusted: 'Bearing-Adjusted',
    historical_avg: 'Historical Avg',
    crop_baseline: 'Crop Baseline',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colors[method] || 'bg-gray-100 text-gray-700'}`}>
      {labels[method] || method}
    </span>
  );
};

const YieldForecastDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generateMessage, setGenerateMessage] = useState(null);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [farmFilter, setFarmFilter] = useState('');
  const [cropFilter, setCropFilter] = useState('');
  const [farms, setFarms] = useState([]);

  const { selectedSeason, setSelectedSeason } = useSeason();

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedSeason) params.season_label = selectedSeason;
      if (farmFilter) params.farm = farmFilter;
      if (cropFilter) params.crop_category = cropFilter;

      const response = await yieldForecastAPI.getDashboard(params);
      setDashboardData(response.data);
    } catch (err) {
      console.error('Error loading forecast dashboard:', err);
      setError('Failed to load forecast data');
    } finally {
      setLoading(false);
    }
  }, [selectedSeason, farmFilter, cropFilter]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const loadFarms = async () => {
      try {
        const response = await farmsAPI.getAll();
        setFarms(response.data?.results || response.data || []);
      } catch (err) {
        // Non-critical
      }
    };
    loadFarms();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateMessage(null);
    try {
      const data = {};
      if (selectedSeason) data.season_label = selectedSeason;
      const response = await yieldForecastAPI.generate(data);
      const result = response.data;
      if (result.error) {
        setGenerateMessage({ type: 'error', text: result.error });
      } else if (result.generated > 0) {
        setGenerateMessage({
          type: 'success',
          text: `Generated ${result.generated} forecast(s)${result.skipped ? `, ${result.skipped} skipped` : ''}.`,
        });
      } else if (result.skipped > 0) {
        setGenerateMessage({
          type: 'warning',
          text: `All ${result.skipped} field(s) were skipped. Fields may lack sufficient data for forecasting.`,
        });
      } else {
        setGenerateMessage({ type: 'warning', text: 'No fields found to forecast.' });
      }
      await loadDashboard();
    } catch (err) {
      console.error('Error generating forecasts:', err);
      const detail = err.response?.data?.error || err.response?.data?.detail || err.message;
      setGenerateMessage({ type: 'error', text: `Failed to generate forecasts: ${detail}` });
    } finally {
      setGenerating(false);
    }
  };

  if (selectedFieldId) {
    return (
      <FieldForecastCard
        fieldId={selectedFieldId}
        seasonLabel={selectedSeason}
        onBack={() => setSelectedFieldId(null)}
      />
    );
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={loadDashboard} />;

  const summary = dashboardData?.summary || {};
  const forecasts = dashboardData?.forecasts || [];
  const dataQuality = dashboardData?.data_quality || {};
  const methodDist = dashboardData?.method_distribution || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Yield Forecasts</h2>
          <p className="text-gray-600 mt-1">
            Field-level yield predictions with confidence intervals
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Season:</label>
          <SeasonSelector
            value={selectedSeason}
            onChange={setSelectedSeason}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="Select Season"
          />
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Generating...' : 'Generate Forecasts'}
          </button>
        </div>
      </div>

      {/* Generate Message Banner */}
      {generateMessage && (
        <div className={`rounded-lg p-3 flex items-center justify-between ${
          generateMessage.type === 'error' ? 'bg-red-50 border border-red-200 text-red-800' :
          generateMessage.type === 'warning' ? 'bg-yellow-50 border border-yellow-200 text-yellow-800' :
          'bg-primary-light border border-green-200 text-green-800'
        }`}>
          <div className="flex items-center gap-2">
            {generateMessage.type === 'error' ? <AlertCircle className="w-4 h-4" /> :
             generateMessage.type === 'warning' ? <AlertTriangle className="w-4 h-4" /> :
             <CheckCircle className="w-4 h-4" />}
            <span className="text-sm">{generateMessage.text}</span>
          </div>
          <button
            onClick={() => setGenerateMessage(null)}
            className="text-sm opacity-60 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <AnalyticsCard
          title="Fields Forecasted"
          value={formatNumber(summary.total_fields)}
          icon={Wheat}
          color="green"
        />
        <AnalyticsCard
          title="Total Predicted Yield"
          value={formatNumber(parseFloat(summary.total_predicted_yield) || 0, 0)}
          icon={BarChart3}
          color="blue"
        />
        <AnalyticsCard
          title="Avg Yield/Acre"
          value={formatNumber(parseFloat(summary.avg_yield_per_acre) || 0, 1)}
          icon={TrendingUp}
          color="purple"
        />
        <AnalyticsCard
          title="Forecast Accuracy"
          value={
            summary.avg_forecast_error_pct
              ? `${(100 - parseFloat(summary.avg_forecast_error_pct)).toFixed(1)}%`
              : 'N/A'
          }
          subtitle={
            summary.forecasts_with_actuals
              ? `${summary.forecasts_with_actuals} verified`
              : 'No actuals yet'
          }
          icon={Target}
          color="orange"
        />
      </div>

      {/* Data Quality Summary + Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium">Data Quality:</span>
            <span className="text-primary">{dataQuality.good || 0} good</span>
            <span className="text-yellow-600">{dataQuality.fair || 0} fair</span>
            <span className="text-red-600">{dataQuality.poor || 0} low</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={farmFilter}
            onChange={(e) => setFarmFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
          >
            <option value="">All Farms</option>
            {farms.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <select
            value={cropFilter}
            onChange={(e) => setCropFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
          >
            <option value="">All Crops</option>
            <option value="citrus">Citrus</option>
            <option value="subtropical">Avocado</option>
            <option value="deciduous_fruit">Deciduous</option>
            <option value="nut">Nuts</option>
            <option value="vine">Vine</option>
          </select>
        </div>
      </div>

      {/* Forecast Table */}
      {forecasts.length === 0 ? (
        <SectionCard title="Getting Started with Yield Forecasts">
          <div className="p-4 space-y-4">
            <p className="text-gray-600">
              Click <strong>Generate Forecasts</strong> above to create yield predictions for your fields.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">How to improve forecast accuracy:</h4>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li><strong>Harvest data</strong> — Log completed harvests with bins/lbs and acres harvested in Harvest & Packing</li>
                <li><strong>Expected yield</strong> — Set "Expected Yield per Acre" on each field (Farms & Fields → Edit → Spacing & Density tab)</li>
                <li><strong>Weather station</strong> — Set a CIMIS Station ID on your farms in Company Settings for climate-adjusted forecasts</li>
                <li><strong>Tree data</strong> — Run satellite or LiDAR detection for NDVI and canopy data</li>
                <li><strong>Management records</strong> — Log irrigation events and nutrient applications</li>
              </ul>
            </div>
            <p className="text-sm text-gray-500">
              The system uses whatever data is available and shows confidence levels accordingly.
              More data = tighter confidence intervals and better predictions.
            </p>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="Field Forecasts">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className={tableHeaderClass}>Field</th>
                  <th className={tableHeaderClass}>Farm</th>
                  <th className={tableHeaderClass}>Crop</th>
                  <th className={`${tableHeaderClass} text-right`}>Yield/Acre</th>
                  <th className={`${tableHeaderClass} text-right`}>80% CI Range</th>
                  <th className={`${tableHeaderClass} text-right`}>Total Yield</th>
                  <th className={tableHeaderClass}>Method</th>
                  <th className={tableHeaderClass}>Data Quality</th>
                  <th className={`${tableHeaderClass} text-right`}>Actual</th>
                  <th className={tableHeaderClass}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {forecasts.map((f) => (
                  <tr
                    key={f.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedFieldId(f.field)}
                  >
                    <td className={`${tableCellClass} font-medium text-gray-900`}>
                      {f.field_name}
                    </td>
                    <td className={tableCellClass}>{f.farm_name}</td>
                    <td className={tableCellClass}>{f.crop_name}</td>
                    <td className={`${tableCellClass} text-right font-semibold`}>
                      {formatNumber(parseFloat(f.predicted_yield_per_acre), 1)}
                      <span className="text-xs text-gray-500 ml-1">{f.yield_unit}</span>
                    </td>
                    <td className={`${tableCellClass} text-right text-sm text-gray-600`}>
                      {formatNumber(parseFloat(f.lower_bound_per_acre), 0)}
                      {' - '}
                      {formatNumber(parseFloat(f.upper_bound_per_acre), 0)}
                    </td>
                    <td className={`${tableCellClass} text-right`}>
                      {formatNumber(parseFloat(f.predicted_total_yield), 0)}
                    </td>
                    <td className={tableCellClass}>
                      <MethodBadge method={f.forecast_method} />
                    </td>
                    <td className={tableCellClass}>
                      <DataQualityBadge completeness={f.data_completeness_pct} />
                    </td>
                    <td className={`${tableCellClass} text-right`}>
                      {f.actual_yield_per_acre
                        ? formatNumber(parseFloat(f.actual_yield_per_acre), 1)
                        : '-'}
                    </td>
                    <td className={tableCellClass}>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </td>
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

export default YieldForecastDashboard;
