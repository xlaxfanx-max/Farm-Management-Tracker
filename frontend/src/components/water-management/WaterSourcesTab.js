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
    <div className="bg-white rounded-xl border border-border p-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted w-5 h-5" />
          <input
            type="text"
            placeholder="Search water sources..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg bg-white focus:ring-[3px] focus:ring-ring focus:border-primary"
          />
        </div>
        <select
          value={filterFarm}
          onChange={(e) => setFilterFarm(e.target.value)}
          className="px-4 py-2.5 border border-border rounded-lg focus:ring-[3px] focus:ring-ring bg-white"
        >
          <option value="">All Farms</option>
          {farms.map(farm => (
            <option key={farm.id} value={farm.id}>{farm.name}</option>
          ))}
        </select>
        <select
          value={filterSourceType}
          onChange={(e) => setFilterSourceType(e.target.value)}
          className="px-4 py-2.5 border border-border rounded-lg focus:ring-[3px] focus:ring-ring bg-white"
        >
          <option value="">All Types</option>
          {Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <button
          onClick={handleRefresh}
          className="p-2.5 border border-border rounded-lg hover:bg-cream-50 text-bark-600"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>

    {/* Sources Grid */}
    {filteredSources.length === 0 ? (
      <div className="bg-white rounded-xl border border-border p-12 text-center">
        <Droplet className="w-12 h-12 text-sand-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-heading mb-2">No water sources found</h3>
        <p className="text-text-secondary mb-6">Get started by adding your first well or water source.</p>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => openWellSourceModal()}
            className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            <Plus className="w-5 h-5" />
            Add Well
          </button>
          <button
            onClick={() => openWaterSourceModal()}
            className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-hover"
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
              className="bg-white rounded-xl border border-border hover:border-border-strong hover:shadow-md transition-all overflow-hidden"
            >
              {/* Card Header */}
              <div className={`px-4 py-3 ${isWell ? 'bg-gradient-to-r from-green-50 to-orange-50 border-b border-green-100' : 'bg-gradient-to-r from-orange-50 to-cream-100 border-b border-orange-200'}`}>
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
                    <div className="flex items-center gap-1 text-text-muted">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-xs font-medium">Inactive</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4">
                <h3 className="font-semibold text-heading mb-1">{source.name}</h3>
                <p className="text-sm text-text-secondary mb-4">{farm?.name}</p>

                {/* Usage Tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {source.used_for_irrigation && (
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Irrigation</span>
                  )}
                  {source.used_for_washing && (
                    <span className="text-xs bg-sand-200 text-bark-700 px-2 py-0.5 rounded-full">Washing</span>
                  )}
                  {source.used_for_pesticide_mixing && (
                    <span className="text-xs bg-yellow-200 text-yellow-700 px-2 py-0.5 rounded-full">Pesticide</span>
                  )}
                </div>

                {/* Test Frequency */}
                <div className="flex items-center gap-2 text-sm text-text-secondary mb-4">
                  <Clock className="w-4 h-4" />
                  <span>Tests every {source.test_frequency_days || 365} days</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t border-border">
                  <button
                    onClick={() => {
                      setSelectedSource(source);
                      setActiveTab('tests');
                    }}
                    className="flex-1 px-3 py-2 text-sm font-medium text-link bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
                  >
                    Tests
                  </button>
                  {isWell && (
                    <button
                      onClick={() => setActiveTab('wells')}
                      className="flex-1 px-3 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      SGMA
                    </button>
                  )}
                  <button
                    onClick={() => isWell ? openWellSourceModal(source) : openWaterSourceModal(source)}
                    className="px-3 py-2 text-sm text-bark-600 bg-cream-100 rounded-lg hover:bg-sand-200 transition-colors"
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
