import React from 'react';
import { Plus, Map, Grid3X3, Layers, Search, ChevronsDown, ChevronsUp, X } from 'lucide-react';

/**
 * FarmToolbar component - Consolidates header controls for Farms page
 *
 * @param {Object} props
 * @param {number} props.totalFarms - Total number of farms
 * @param {number} props.filteredCount - Number of farms after filtering
 * @param {number} props.totalFields - Total number of fields
 * @param {number} props.mappedFarms - Number of farms with GPS coordinates
 * @param {string} props.viewMode - Current view mode ('cards', 'map', 'split')
 * @param {Function} props.onViewModeChange - Callback when view mode changes
 * @param {string} props.searchTerm - Current search term
 * @param {Function} props.onSearchChange - Callback when search changes
 * @param {string} props.filterCounty - Current county filter
 * @param {Function} props.onCountyChange - Callback when county filter changes
 * @param {string} props.filterMapped - Current mapping status filter
 * @param {Function} props.onMappedChange - Callback when mapping filter changes
 * @param {Array} props.counties - List of unique counties for dropdown
 * @param {Function} props.onExpandAll - Callback to expand all farms
 * @param {Function} props.onCollapseAll - Callback to collapse all farms
 * @param {Function} props.onAddFarm - Callback when Add Farm is clicked
 * @param {boolean} props.showExpandCollapse - Whether to show expand/collapse buttons
 */
function FarmToolbar({
  totalFarms,
  filteredCount,
  totalFields,
  mappedFarms,
  viewMode,
  onViewModeChange,
  searchTerm,
  onSearchChange,
  filterCounty,
  onCountyChange,
  filterMapped,
  onMappedChange,
  counties,
  onExpandAll,
  onCollapseAll,
  onAddFarm,
  showExpandCollapse = true
}) {
  const hasFilters = searchTerm || filterCounty || filterMapped !== 'all';

  const clearFilters = () => {
    onSearchChange('');
    onCountyChange('');
    onMappedChange('all');
  };

  return (
    <div className="space-y-4">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Farms & Fields</h2>
          <p className="text-gray-600 mt-1">
            {filteredCount === totalFarms
              ? `${totalFarms} farms · ${totalFields} fields`
              : `${filteredCount} of ${totalFarms} farms`}
            {mappedFarms > 0 && ` · ${mappedFarms} mapped`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Expand/Collapse All */}
          {showExpandCollapse && (viewMode === 'cards' || viewMode === 'split') && filteredCount > 0 && (
            <div className="flex items-center border-r border-gray-300 pr-3">
              <button
                onClick={onExpandAll}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                title="Expand all farms"
              >
                <ChevronsDown className="w-4 h-4" />
              </button>
              <button
                onClick={onCollapseAll}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                title="Collapse all farms"
              >
                <ChevronsUp className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => onViewModeChange('cards')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'cards'
                  ? 'bg-white shadow text-green-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Card View"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewModeChange('map')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'map'
                  ? 'bg-white shadow text-green-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Map View"
            >
              <Map className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewModeChange('split')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'split'
                  ? 'bg-white shadow text-green-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Split View"
            >
              <Layers className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={onAddFarm}
            className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 shadow-lg transition-colors"
          >
            <Plus size={20} />
            Add Farm
          </button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      {(viewMode === 'cards' || viewMode === 'split') && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search farms by name, owner, county..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              {searchTerm && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* County Filter */}
            <select
              value={filterCounty}
              onChange={(e) => onCountyChange(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white min-w-[160px]"
            >
              <option value="">All Counties</option>
              {counties.map(county => (
                <option key={county} value={county}>{county}</option>
              ))}
            </select>

            {/* Mapping Status Filter */}
            <select
              value={filterMapped}
              onChange={(e) => onMappedChange(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white min-w-[160px]"
            >
              <option value="all">All Status</option>
              <option value="mapped">Mapped Only</option>
              <option value="unmapped">Needs Mapping</option>
            </select>

            {/* Clear Filters */}
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="px-4 py-2.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default FarmToolbar;
