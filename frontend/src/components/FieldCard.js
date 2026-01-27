import React, { useState, useRef, useEffect } from 'react';
import { Sprout, Edit, Trash2, MapPin, TreeDeciduous, Mountain, MoreVertical } from 'lucide-react';
import QuarantineStatusBadge from './QuarantineStatusBadge';

/**
 * FieldCard component - Displays a single field within a farm
 *
 * @param {Object} props
 * @param {Object} props.field - Field data object
 * @param {number} props.farmId - Parent farm ID
 * @param {boolean} props.isSelected - Whether this field is selected
 * @param {number} props.applicationCount - Number of applications for this field
 * @param {Function} props.onSelect - Callback when field is clicked/selected
 * @param {Function} props.onEdit - Callback when edit button clicked
 * @param {Function} props.onDelete - Callback when delete button clicked
 * @param {Function} props.onDrawBoundary - Callback when draw/edit boundary clicked
 * @param {Function} props.onTreeSummary - Callback when tree summary button clicked
 * @param {Function} props.onLiDARSummary - Callback when LiDAR summary button clicked
 */
function FieldCard({
  field,
  farmId,
  isSelected,
  applicationCount,
  onSelect,
  onEdit,
  onDelete,
  onDrawBoundary,
  onTreeSummary,
  onLiDARSummary
}) {
  const hasBoundary = !!field.boundary_geojson;

  // Mobile action menu state
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const mobileMenuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) {
        setShowMobileMenu(false);
      }
    };
    if (showMobileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMobileMenu]);

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow border-2 p-4 hover:shadow-md transition-all cursor-pointer ${
        isSelected ? 'border-blue-500' : 'border-gray-200 dark:border-gray-700'
      }`}
      onClick={() => onSelect(field.id)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Sprout className="w-4 h-4 text-green-600 dark:text-green-400" />
            <h5 className="font-bold text-gray-900 dark:text-white">{field.name}</h5>
          </div>
          {field.field_number && (
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{field.field_number}</p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {hasBoundary ? (
            <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 rounded text-xs">
              Mapped
            </span>
          ) : (
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded text-xs">
              No boundary
            </span>
          )}
          {/* HLB Quarantine Status for Field */}
          {(field.gps_latitude || hasBoundary) && (
            <QuarantineStatusBadge
              fieldId={field.id}
              compact={true}
              showRefresh={false}
            />
          )}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Crop:</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {field.crop_name || field.current_crop || 'Not set'}
          </span>
        </div>
        {field.rootstock_name && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Rootstock:</span>
            <span className="font-medium text-gray-900 dark:text-white">{field.rootstock_name}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Acres:</span>
          <span className="font-medium text-gray-900 dark:text-white">{field.total_acres || '0'}</span>
        </div>
        {(field.row_spacing_ft || field.tree_spacing_ft) && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Spacing:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {field.row_spacing_ft && `${field.row_spacing_ft}ft rows`}
              {field.row_spacing_ft && field.tree_spacing_ft && ' × '}
              {field.tree_spacing_ft && `${field.tree_spacing_ft}ft trees`}
            </span>
          </div>
        )}
        {field.trees_per_acre && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Density:</span>
            <span className="font-medium text-gray-900 dark:text-white">{field.trees_per_acre} trees/acre</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">County:</span>
          <span className="font-medium text-gray-900 dark:text-white">{field.county || 'Not set'}</span>
        </div>
        {(field.plss_section || field.plss_township || field.plss_range) && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Location:</span>
            <span className="font-medium text-gray-900 dark:text-white text-xs">
              {field.plss_section && `S${field.plss_section}`}
              {field.plss_township && ` T${field.plss_township}`}
              {field.plss_range && ` R${field.plss_range}`}
            </span>
          </div>
        )}
        {field.organic_status && field.organic_status !== 'conventional' && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Organic:</span>
            <span className={`font-medium ${field.organic_status === 'certified' ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
              {field.organic_status === 'certified' ? 'Certified' : 'Transitional'}
            </span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Applications:</span>
          <span className="font-medium text-blue-600 dark:text-blue-400">{applicationCount}</span>
        </div>
        {/* Satellite Tree Detection Data */}
        {field.latest_satellite_tree_count && (
          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
                <TreeDeciduous className="w-3 h-3" />
                Detected Trees:
              </span>
              <span className="font-medium text-green-600 dark:text-green-400">
                {field.latest_satellite_tree_count.toLocaleString()}
              </span>
            </div>
            {field.latest_satellite_trees_per_acre && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Trees/Acre:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {field.latest_satellite_trees_per_acre.toFixed(1)}
                </span>
              </div>
            )}
            {field.satellite_canopy_coverage_percent && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Canopy:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {field.satellite_canopy_coverage_percent.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons - Desktop */}
      <div className="hidden sm:flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => onDrawBoundary(field, farmId)}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded hover:bg-green-100 dark:hover:bg-green-900/50 text-sm font-medium transition-colors"
        >
          <MapPin size={14} />
          {hasBoundary ? 'Edit Map' : 'Draw Map'}
        </button>
        {hasBoundary && (
          <>
            <button
              onClick={() => onTreeSummary(field.id)}
              className="flex items-center justify-center gap-1 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded hover:bg-purple-100 dark:hover:bg-purple-900/50 text-sm font-medium transition-colors"
              title="View Satellite Tree Detection"
            >
              <TreeDeciduous size={14} />
            </button>
            <button
              onClick={() => onLiDARSummary(field.id)}
              className="flex items-center justify-center gap-1 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-sm font-medium transition-colors"
              title="View LiDAR Analysis"
            >
              <Mountain size={14} />
            </button>
          </>
        )}
        <button
          onClick={() => onEdit(field)}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 text-sm font-medium transition-colors"
        >
          <Edit size={14} />
          Edit
        </button>
        <button
          onClick={() => onDelete(field.id)}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-900/50 text-sm font-medium transition-colors"
        >
          <Trash2 size={14} />
          Delete
        </button>
      </div>

      {/* Action Buttons - Mobile */}
      <div className="flex sm:hidden gap-2 pt-3 border-t border-gray-100 dark:border-gray-700" onClick={e => e.stopPropagation()}>
        {/* Primary action: Draw/Edit Map */}
        <button
          onClick={() => onDrawBoundary(field, farmId)}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded hover:bg-green-100 dark:hover:bg-green-900/50 text-sm font-medium transition-colors"
        >
          <MapPin size={14} />
          {hasBoundary ? 'Edit Map' : 'Draw Map'}
        </button>

        {/* More actions dropdown */}
        <div className="relative" ref={mobileMenuRef}>
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="p-2 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            title="More actions"
          >
            <MoreVertical size={16} />
          </button>

          {/* Dropdown Menu */}
          {showMobileMenu && (
            <div className="absolute right-0 bottom-full mb-1 w-44 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
              {hasBoundary && (
                <>
                  <button
                    onClick={() => {
                      onTreeSummary(field.id);
                      setShowMobileMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <TreeDeciduous size={14} className="text-purple-600 dark:text-purple-400" />
                    <span>Tree Detection</span>
                  </button>
                  <button
                    onClick={() => {
                      onLiDARSummary(field.id);
                      setShowMobileMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Mountain size={14} className="text-emerald-600 dark:text-emerald-400" />
                    <span>LiDAR Analysis</span>
                  </button>
                  <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                </>
              )}
              <button
                onClick={() => {
                  onEdit(field);
                  setShowMobileMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Edit size={14} className="text-blue-600 dark:text-blue-400" />
                <span>Edit Field</span>
              </button>
              <button
                onClick={() => {
                  onDelete(field.id);
                  setShowMobileMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
              >
                <Trash2 size={14} />
                <span>Delete Field</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FieldCard;
