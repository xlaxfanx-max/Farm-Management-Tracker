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
          <p className="text-bark-600 mt-1">
            {filteredCount === totalFarms
              ? `${totalFarms} farms · ${totalFields} fields`
              : `${filteredCount} of ${totalFarms} farms`}
            {mappedFarms > 0 && ` · ${mappedFarms} mapped`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Expand/Collapse All */}
          {showExpandCollapse && (viewMode === 'cards' || viewMode === 'split') && filteredCount > 0 && (
            <div className="flex items-center border-r border-border-strong pr-3">
              <button
                onClick={onExpandAll}
                className="p-2 text-text-secondary hover:text-bark-700 hover:bg-cream-100 rounded-lg transition-colors"
                title="Expand all farms"
              >
                <ChevronsDown className="w-4 h-4" />
              </button>
              <button
                onClick={onCollapseAll}
                className="p-2 text-text-secondary hover:text-bark-700 hover:bg-cream-100 rounded-lg transition-colors"
                title="Collapse all farms"
              >
                <ChevronsUp className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center bg-cream-100 rounded-lg p-1">
            <button
              onClick={() => onViewModeChange('cards')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'cards'
                  ? 'bg-surface-raised shadow text-primary'
                  : 'text-text-secondary hover:text-bark-700'
              }`}
              title="Card View"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewModeChange('map')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'map'
                  ? 'bg-surface-raised shadow text-primary'
                  : 'text-text-secondary hover:text-bark-700'
              }`}
              title="Map View"
            >
              <Map className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewModeChange('split')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'split'
                  ? 'bg-surface-raised shadow text-primary'
                  : 'text-text-secondary hover:text-bark-700'
              }`}
              title="Split View"
            >
              <Layers className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={onAddFarm}
            className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-button hover:bg-primary-hover shadow-lg transition-colors"
          >
            <Plus size={20} />
            Add Farm
          </button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      {(viewMode === 'cards' || viewMode === 'split') && (
        <div className="bg-surface-raised rounded-card border border-border p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted w-5 h-5" />
              <input
                type="text"
                placeholder="Search farms by name, owner, county..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 border border-border rounded-card focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              {searchTerm && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-muted hover:text-bark-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* County Filter */}
            <select
              value={filterCounty}
              onChange={(e) => onCountyChange(e.target.value)}
              className="min-w-[160px] px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
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
              className="min-w-[160px] px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
            >
              <option value="all">All Status</option>
              <option value="mapped">Mapped Only</option>
              <option value="unmapped">Needs Mapping</option>
            </select>

            {/* Clear Filters */}
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="px-4 py-2.5 text-bark-600 hover:text-text hover:bg-cream-100 rounded-lg transition-colors flex items-center gap-2"
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
