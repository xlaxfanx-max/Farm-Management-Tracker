// =============================================================================
// HARVEST ANALYTICS COMPONENT
// =============================================================================
// Displays cost analysis, performance metrics, and business intelligence for harvests

import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Users, BarChart3, AlertCircle } from 'lucide-react';
import { harvestsAPI } from '../services/api';
import SeasonSelector from './SeasonSelector';
import { useSeason } from '../contexts/SeasonContext';

const HarvestAnalytics = () => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Use shared season context (persists across pages)
  const { selectedSeason, setSelectedSeason, seasonDates } = useSeason();

  // Load analytics data when season or dates change
  useEffect(() => {
    if (selectedSeason) {
      loadAnalytics();
    }
  }, [selectedSeason, seasonDates]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { season: selectedSeason };
      // Include date range if available for more precise filtering
      if (seasonDates) {
        params.start_date = seasonDates.start_date;
        params.end_date = seasonDates.end_date;
      }
      const response = await harvestsAPI.getCostAnalysis(params);
      setAnalyticsData(response.data);
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!analyticsData || analyticsData.total_harvests === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">No harvest data available for the selected period</div>
      </div>
    );
  }

  const { metrics, by_crop, by_field, by_contractor } = analyticsData;

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Harvest Analytics</h2>
          <p className="text-gray-600 mt-1">
            {analyticsData.total_harvests} harvests analyzed
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Season:</label>
          <SeasonSelector
            value={selectedSeason}
            onChange={setSelectedSeason}
            className="border rounded-lg px-3 py-2"
            placeholder="Select Season"
          />
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Total Revenue</span>
            <DollarSign size={20} className="text-green-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ${metrics.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {metrics.total_bins.toLocaleString()} bins • {metrics.total_acres.toFixed(1)} acres
          </div>
        </div>

        {/* Total Profit */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Net Profit</span>
            <TrendingUp size={20} className="text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ${metrics.total_profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {metrics.profit_margin.toFixed(1)}% margin
          </div>
        </div>

        {/* Cost Per Bin */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Avg Cost/Bin</span>
            <BarChart3 size={20} className="text-orange-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ${metrics.avg_cost_per_bin.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            ${metrics.avg_cost_per_acre.toFixed(2)} per acre
          </div>
        </div>

        {/* Labor Efficiency */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Labor Efficiency</span>
            <Users size={20} className="text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {metrics.avg_bins_per_hour.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            bins per hour • {metrics.total_labor_hours.toFixed(0)} total hours
          </div>
        </div>
      </div>

      {/* Performance by Crop */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance by Crop Variety</h3>
        {by_crop.length === 0 ? (
          <p className="text-gray-500">No crop data available</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Crop</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Harvests</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Bins</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Revenue</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Cost</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Profit</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Cost/Bin</th>
                </tr>
              </thead>
              <tbody>
                {by_crop.map(crop => (
                  <tr key={crop.crop_variety} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-3 font-medium text-gray-900">{crop.crop_variety_display}</td>
                    <td className="py-3 px-3 text-right text-gray-700">{crop.harvest_count}</td>
                    <td className="py-3 px-3 text-right text-gray-700">{crop.total_bins.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right text-gray-700">
                      ${crop.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-700">
                      ${crop.total_labor_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`py-3 px-3 text-right font-medium ${crop.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${crop.profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-700">
                      ${crop.avg_cost_per_bin.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Performance by Field */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance by Field</h3>
        {by_field.length === 0 ? (
          <p className="text-gray-500">No field data available</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Field</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Farm</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Harvests</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Profit</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Revenue/Acre</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Cost/Bin</th>
                </tr>
              </thead>
              <tbody>
                {by_field.slice(0, 10).map((field, idx) => (
                  <tr key={field.field_id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-3 font-medium text-gray-900">{field.field_name}</td>
                    <td className="py-3 px-3 text-gray-700">{field.farm_name}</td>
                    <td className="py-3 px-3 text-right text-gray-700">{field.harvest_count}</td>
                    <td className={`py-3 px-3 text-right font-medium ${field.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${field.profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-700">
                      ${field.revenue_per_acre.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-700">
                      ${field.cost_per_bin.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {by_field.length > 10 && (
              <p className="text-sm text-gray-500 mt-2">Showing top 10 fields by profit</p>
            )}
          </div>
        )}
      </div>

      {/* Contractor Performance */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Contractor Performance</h3>
        {by_contractor.length === 0 ? (
          <p className="text-gray-500">No contractor data available</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Contractor</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Harvests</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Total Bins</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Hours</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Bins/Hour</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Cost/Bin</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {by_contractor.map((contractor, idx) => (
                  <tr key={contractor.contractor_id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-3 font-medium text-gray-900">
                      {contractor.contractor_name}
                      {idx === 0 && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Most Efficient
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-700">{contractor.harvest_count}</td>
                    <td className="py-3 px-3 text-right text-gray-700">{contractor.total_bins.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right text-gray-700">{contractor.total_hours.toFixed(1)}</td>
                    <td className="py-3 px-3 text-right font-medium text-blue-600">
                      {contractor.bins_per_hour.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-700">
                      ${contractor.cost_per_bin.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-700">
                      ${contractor.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default HarvestAnalytics;
