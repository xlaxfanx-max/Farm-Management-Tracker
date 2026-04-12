// =============================================================================
// WATER SOURCES TAB
// =============================================================================

import React from 'react';
import {
  Plus, Search, CheckCircle, Clock, Droplet,
  AlertCircle, Edit, RefreshCw
} from 'lucide-react';
import { SOURCE_TYPE_LABELS, SOURCE_TYPE_COLORS } from './constants';

const WaterSourcesTab = ({
  filteredSources,
  farms,
  searchTerm,
  setSearchTerm,
  filterFarm,
  setFilterFarm,
  filterSourceType,
  setFilterSourceType,
  loading,
  handleRefresh,
  setSelectedSource,
  setActiveTab,
  openWellSourceModal,
  openWaterSourceModal
}) => (
  <div className="space-y-6">
    {/* Search and Filters */}
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search water sources..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={filterFarm}
          onChange={(e) => setFilterFarm(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-gray-200"
        >
          <option value="">All Farms</option>
          {farms.map(farm => (
            <option key={farm.id} value={farm.id}>{farm.name}</option>
          ))}
        </select>
        <select
          value={filterSourceType}
          onChange={(e) => setFilterSourceType(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-gray-200"
        >
          <option value="">All Types</option>
          {Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <button
          onClick={handleRefresh}
          className="p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>

    {/* Sources Grid */}
    {filteredSources.length === 0 ? (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
        <Droplet className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No water sources found</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Get started by adding your first well or water source.</p>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => openWellSourceModal()}
            className="inline-flex items-center gap-2 bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700"
          >
            <Plus className="w-5 h-5" />
            Add Well
          </button>
          <button
            onClick={() => openWaterSourceModal()}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            Add Other Source
          </button>
        </div>
      </div>
    ) : (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredSources.map(source => {
          const farm = farms.find(f => f.id === source.farm);
          const isWell = source.source_type === 'well';

          return (
            <div
              key={source.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all overflow-hidden"
            >
              {/* Card Header */}
              <div className={`px-4 py-3 ${isWell ? 'bg-gradient-to-r from-cyan-50 to-blue-50 border-b border-cyan-100' : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${SOURCE_TYPE_COLORS[source.source_type]}`}>
                      {SOURCE_TYPE_LABELS[source.source_type]}
                    </span>
                  </div>
                  {source.active ? (
                    <div className="flex items-center gap-1 text-primary">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-xs font-medium">Active</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-gray-400">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-xs font-medium">Inactive</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{source.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{farm?.name}</p>

                {/* Usage Tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {source.used_for_irrigation && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Irrigation</span>
                  )}
                  {source.used_for_washing && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Washing</span>
                  )}
                  {source.used_for_pesticide_mixing && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Pesticide</span>
                  )}
                </div>

                {/* Test Frequency */}
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
                  <Clock className="w-4 h-4" />
                  <span>Tests every {source.test_frequency_days || 365} days</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <button
                    onClick={() => {
                      setSelectedSource(source);
                      setActiveTab('tests');
                    }}
                    className="flex-1 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    Tests
                  </button>
                  {isWell && (
                    <button
                      onClick={() => setActiveTab('wells')}
                      className="flex-1 px-3 py-2 text-sm font-medium text-cyan-600 bg-cyan-50 rounded-lg hover:bg-cyan-100 transition-colors"
                    >
                      SGMA
                    </button>
                  )}
                  <button
                    onClick={() => isWell ? openWellSourceModal(source) : openWaterSourceModal(source)}
                    className="px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

export default WaterSourcesTab;
