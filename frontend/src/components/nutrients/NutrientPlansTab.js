import React from 'react';
import { Edit } from 'lucide-react';

const formatNumber = (num, decimals = 1) => {
  if (num === null || num === undefined) return '-';
  return Number(num).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

const NutrientPlansTab = ({
  plans,
  filterYear,
  setFilterYear,
  filterFarm,
  setFilterFarm,
  yearOptions,
  farms,
}) => (
  <div className="space-y-6">
    <div className="flex gap-4 items-center">
      <select
        value={filterYear}
        onChange={(e) => setFilterYear(parseInt(e.target.value))}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
      >
        {yearOptions.map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>

      <select
        value={filterFarm}
        onChange={(e) => setFilterFarm(e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
      >
        <option value="">All Farms</option>
        {farms.map(farm => (
          <option key={farm.id} value={farm.id}>{farm.name}</option>
        ))}
      </select>
    </div>

    {/* Plans List */}
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Field</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Year</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Crop</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Planned N</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actual N</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">% Applied</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {plans.length === 0 ? (
            <tr>
              <td colSpan="8" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                No nitrogen plans for {filterYear}. Click "Add Plan" to create one.
              </td>
            </tr>
          ) : (
            plans.map((plan) => (
              <tr key={plan.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{plan.field_name}</div>
                  <div className="text-xs text-gray-500">{plan.farm_name}</div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">{plan.year}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{plan.crop}</td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                  {formatNumber(plan.planned_nitrogen_lbs_acre)} lbs/ac
                </td>
                <td className="px-4 py-3 text-sm font-medium text-primary text-right">
                  {formatNumber(plan.actual_nitrogen_applied_per_acre)} lbs/ac
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                  {formatNumber(plan.percent_of_plan_applied, 0)}%
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    plan.status === 'active' ? 'bg-green-100 text-green-800' :
                    plan.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {plan.status_display || plan.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => console.log('Nutrient plan modal not yet implemented')}
                    className="text-blue-600 hover:text-blue-800"
                    title="Edit"
                    disabled
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

export default NutrientPlansTab;
