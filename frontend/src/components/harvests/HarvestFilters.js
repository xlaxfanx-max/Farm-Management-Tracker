import React from 'react';
import { HARVEST_CONSTANTS } from '../../services/api';

const HarvestFilters = ({ filters, setFilters, farms, getFilteredFields }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="grid grid-cols-5 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Season</label>
          <select
            value={filters.season}
            onChange={(e) => setFilters({ ...filters, season: e.target.value })}
            className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-200"
          >
            <option value="">All Seasons</option>
            {[...Array(5)].map((_, i) => {
              const year = new Date().getFullYear() - i;
              return <option key={year} value={year}>{year}</option>;
            })}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Farm</label>
          <select
            value={filters.farm}
            onChange={(e) => setFilters({ ...filters, farm: e.target.value, field: '' })}
            className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-200"
          >
            <option value="">All Farms</option>
            {farms.map(farm => (
              <option key={farm.id} value={farm.id}>{farm.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Field</label>
          <select
            value={filters.field}
            onChange={(e) => setFilters({ ...filters, field: e.target.value })}
            className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-200"
          >
            <option value="">All Fields</option>
            {getFilteredFields().map(field => (
              <option key={field.id} value={field.id}>{field.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Crop</label>
          <select
            value={filters.crop_variety}
            onChange={(e) => setFilters({ ...filters, crop_variety: e.target.value })}
            className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-200"
          >
            <option value="">All Crops</option>
            {HARVEST_CONSTANTS.CROP_VARIETIES.map(crop => (
              <option key={crop.value} value={crop.value}>{crop.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-200"
          >
            <option value="">All Statuses</option>
            {HARVEST_CONSTANTS.HARVEST_STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default HarvestFilters;
