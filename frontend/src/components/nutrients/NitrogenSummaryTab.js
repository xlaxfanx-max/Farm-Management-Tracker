import React from 'react';
import { Download, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const formatNumber = (num, decimals = 1) => {
  if (num === null || num === undefined) return '-';
  return Number(num).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

const NitrogenSummaryTab = ({
  summary,
  filterYear,
  setFilterYear,
  filterFarm,
  setFilterFarm,
  yearOptions,
  farms,
  onExport,
}) => (
  <div className="space-y-6">
    {/* Export Button */}
    <div className="flex justify-between items-center">
      <div className="flex gap-4 items-center">
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(parseInt(e.target.value))}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary"
        >
          {yearOptions.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <select
          value={filterFarm}
          onChange={(e) => setFilterFarm(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary"
        >
          <option value="">All Farms</option>
          {farms.map(farm => (
            <option key={farm.id} value={farm.id}>{farm.name}</option>
          ))}
        </select>
      </div>

      <button
        onClick={onExport}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover"
      >
        <Download className="w-4 h-4" />
        Export Excel
      </button>
    </div>

    {/* Summary Table */}
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
        <h3 className="font-medium text-gray-900 dark:text-white">Nitrogen Summary by Field - {filterYear}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Annual nitrogen application totals for ILRP reporting</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Field</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Farm</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Acres</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Crop</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Apps</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total N (lbs)</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">N/Acre</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">vs Plan</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {summary.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  No data for {filterYear}. Add nutrient applications to see summary.
                </td>
              </tr>
            ) : (
              summary.map((row, idx) => (
                <tr key={row.field_id || idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-gray-200">
                    {row.field_name}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {row.farm_name}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                    {formatNumber(row.acres)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {row.crop}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                    {row.total_applications}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                    {formatNumber(row.total_lbs_nitrogen, 0)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-primary text-right">
                    {formatNumber(row.lbs_nitrogen_per_acre)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    {row.has_plan ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        row.variance_lbs_acre > 10
                          ? 'bg-red-100 text-red-800'
                          : row.variance_lbs_acre < -10
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                      }`}>
                        {row.variance_lbs_acre > 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : row.variance_lbs_acre < 0 ? (
                          <TrendingDown className="w-3 h-3" />
                        ) : (
                          <Minus className="w-3 h-3" />
                        )}
                        {row.variance_lbs_acre > 0 ? '+' : ''}{formatNumber(row.variance_lbs_acre)}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">No plan</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {summary.length > 0 && (
            <tfoot className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <td colSpan="4" className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">Totals</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                  {summary.reduce((sum, r) => sum + r.total_applications, 0)}
                </td>
                <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                  {formatNumber(summary.reduce((sum, r) => sum + (r.total_lbs_nitrogen || 0), 0), 0)}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-primary text-right">
                  {formatNumber(
                    summary.reduce((sum, r) => sum + (r.total_lbs_nitrogen || 0), 0) /
                    Math.max(summary.reduce((sum, r) => sum + (r.acres || 0), 0), 1)
                  )}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  </div>
);

export default NitrogenSummaryTab;
