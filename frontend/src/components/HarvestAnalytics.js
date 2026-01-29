// =============================================================================
// HARVEST ANALYTICS COMPONENT
// =============================================================================
// Displays cost analysis, performance metrics, and business intelligence for harvests

import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Users, BarChart3 } from 'lucide-react';
import { harvestsAPI } from '../services/api';
import SeasonSelector from './SeasonSelector';
import { useSeason } from '../contexts/SeasonContext';
import {
  AnalyticsCard,
  LoadingState,
  ErrorState,
  EmptyState,
  SectionCard,
  formatCurrency,
  formatNumber,
  tableHeaderClass,
  tableCellClass,
} from './analytics/analyticsShared';

const HarvestAnalytics = () => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { selectedSeason, setSelectedSeason, seasonDates } = useSeason();

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

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={loadAnalytics} />;
  if (!analyticsData || analyticsData.total_harvests === 0) {
    return <EmptyState message="No harvest data available for the selected period" />;
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
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="Select Season"
          />
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnalyticsCard
          title="Total Revenue"
          value={formatCurrency(metrics.total_revenue, { compact: true })}
          subtitle={`${formatNumber(metrics.total_bins)} bins • ${formatNumber(metrics.total_acres, 1)} acres`}
          icon={DollarSign}
          color="green"
        />
        <AnalyticsCard
          title="Net Profit"
          value={formatCurrency(metrics.total_profit, { compact: true })}
          subtitle={`${formatNumber(metrics.profit_margin, 1)}% margin`}
          icon={TrendingUp}
          color={metrics.total_profit >= 0 ? 'green' : 'red'}
        />
        <AnalyticsCard
          title="Avg Cost/Bin"
          value={formatCurrency(metrics.avg_cost_per_bin)}
          subtitle={`${formatCurrency(metrics.avg_cost_per_acre)} per acre`}
          icon={BarChart3}
          color="orange"
        />
        <AnalyticsCard
          title="Labor Efficiency"
          value={formatNumber(metrics.avg_bins_per_hour, 2)}
          subtitle={`bins per hour • ${formatNumber(metrics.total_labor_hours)} total hours`}
          icon={Users}
          color="purple"
        />
      </div>

      {/* Performance by Crop */}
      <SectionCard title="Performance by Crop Variety">
        {by_crop.length === 0 ? (
          <EmptyState message="No crop data available" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className={`${tableHeaderClass} text-left`}>Crop</th>
                  <th className={`${tableHeaderClass} text-right`}>Harvests</th>
                  <th className={`${tableHeaderClass} text-right`}>Bins</th>
                  <th className={`${tableHeaderClass} text-right`}>Revenue</th>
                  <th className={`${tableHeaderClass} text-right`}>Cost</th>
                  <th className={`${tableHeaderClass} text-right`}>Profit</th>
                  <th className={`${tableHeaderClass} text-right`}>Cost/Bin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {by_crop.map(crop => (
                  <tr key={crop.crop_variety} className="hover:bg-gray-50">
                    <td className={`${tableCellClass} font-medium text-gray-900`}>{crop.crop_variety_display}</td>
                    <td className={`${tableCellClass} text-right text-gray-700`}>{crop.harvest_count}</td>
                    <td className={`${tableCellClass} text-right text-gray-700`}>{formatNumber(crop.total_bins)}</td>
                    <td className={`${tableCellClass} text-right text-gray-700`}>{formatCurrency(crop.total_revenue)}</td>
                    <td className={`${tableCellClass} text-right text-gray-700`}>{formatCurrency(crop.total_labor_cost)}</td>
                    <td className={`${tableCellClass} text-right font-medium ${crop.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(crop.profit)}
                    </td>
                    <td className={`${tableCellClass} text-right text-gray-700`}>{formatCurrency(crop.avg_cost_per_bin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Performance by Field */}
      <SectionCard title="Performance by Field">
        {by_field.length === 0 ? (
          <EmptyState message="No field data available" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className={`${tableHeaderClass} text-left`}>Field</th>
                  <th className={`${tableHeaderClass} text-left`}>Farm</th>
                  <th className={`${tableHeaderClass} text-right`}>Harvests</th>
                  <th className={`${tableHeaderClass} text-right`}>Profit</th>
                  <th className={`${tableHeaderClass} text-right`}>Revenue/Acre</th>
                  <th className={`${tableHeaderClass} text-right`}>Cost/Bin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {by_field.slice(0, 10).map((field) => (
                  <tr key={field.field_id} className="hover:bg-gray-50">
                    <td className={`${tableCellClass} font-medium text-gray-900`}>{field.field_name}</td>
                    <td className={`${tableCellClass} text-gray-700`}>{field.farm_name}</td>
                    <td className={`${tableCellClass} text-right text-gray-700`}>{field.harvest_count}</td>
                    <td className={`${tableCellClass} text-right font-medium ${field.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(field.profit)}
                    </td>
                    <td className={`${tableCellClass} text-right text-gray-700`}>{formatCurrency(field.revenue_per_acre)}</td>
                    <td className={`${tableCellClass} text-right text-gray-700`}>{formatCurrency(field.cost_per_bin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {by_field.length > 10 && (
              <p className="text-sm text-gray-500 mt-2 px-4 pb-3">Showing top 10 fields by profit</p>
            )}
          </div>
        )}
      </SectionCard>

      {/* Contractor Performance */}
      <SectionCard title="Contractor Performance">
        {by_contractor.length === 0 ? (
          <EmptyState message="No contractor data available" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className={`${tableHeaderClass} text-left`}>Contractor</th>
                  <th className={`${tableHeaderClass} text-right`}>Harvests</th>
                  <th className={`${tableHeaderClass} text-right`}>Total Bins</th>
                  <th className={`${tableHeaderClass} text-right`}>Hours</th>
                  <th className={`${tableHeaderClass} text-right`}>Bins/Hour</th>
                  <th className={`${tableHeaderClass} text-right`}>Cost/Bin</th>
                  <th className={`${tableHeaderClass} text-right`}>Total Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {by_contractor.map((contractor, idx) => (
                  <tr key={contractor.contractor_id} className="hover:bg-gray-50">
                    <td className={`${tableCellClass} font-medium text-gray-900`}>
                      {contractor.contractor_name}
                      {idx === 0 && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Most Efficient
                        </span>
                      )}
                    </td>
                    <td className={`${tableCellClass} text-right text-gray-700`}>{contractor.harvest_count}</td>
                    <td className={`${tableCellClass} text-right text-gray-700`}>{formatNumber(contractor.total_bins)}</td>
                    <td className={`${tableCellClass} text-right text-gray-700`}>{formatNumber(contractor.total_hours, 1)}</td>
                    <td className={`${tableCellClass} text-right font-medium text-blue-600`}>
                      {formatNumber(contractor.bins_per_hour, 2)}
                    </td>
                    <td className={`${tableCellClass} text-right text-gray-700`}>{formatCurrency(contractor.cost_per_bin)}</td>
                    <td className={`${tableCellClass} text-right text-gray-700`}>{formatCurrency(contractor.total_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
};

export default HarvestAnalytics;
