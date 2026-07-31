import React, { useState, useRef, useEffect } from 'react';
import { Sprout, Edit, Trash2, MapPin, TreeDeciduous, Mountain, MoreVertical } from 'lucide-react';

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
      className={`bg-white rounded-lg shadow border-2 p-4 hover:shadow-md transition-all cursor-pointer ${
        isSelected ? 'border-primary' : 'border-border'
      }`}
      onClick={() => onSelect(field.id)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Sprout className="w-4 h-4 text-primary" />
            <h5 className="font-bold text-heading">{field.name}</h5>
          </div>
          {field.field_number && (
            <p className="text-xs text-text-secondary font-mono">{field.field_number}</p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {hasBoundary ? (
            <span className="px-2 py-0.5 bg-green-100 text-primary rounded text-xs">
              Mapped
            </span>
          ) : (
            <span className="px-2 py-0.5 bg-cream-100 text-text-secondary rounded text-xs">
              No boundary
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-bark-600">Crop:</span>
          <span className="font-medium text-heading">
            {field.crop_name || field.current_crop || 'Not set'}
          </span>
        </div>
        {field.rootstock_name && (
          <div className="flex justify-between text-sm">
            <span className="text-bark-600">Rootstock:</span>
            <span className="font-medium text-heading">{field.rootstock_name}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-bark-600">Acres:</span>
          <span className="font-medium text-heading">{field.total_acres || '0'}</span>
        </div>
        {(field.row_spacing_ft || field.tree_spacing_ft) && (
          <div className="flex justify-between text-sm">
            <span className="text-bark-600">Spacing:</span>
            <span className="font-medium text-heading">
              {field.row_spacing_ft && `${field.row_spacing_ft}ft rows`}
              {field.row_spacing_ft && field.tree_spacing_ft && ' × '}
              {field.tree_spacing_ft && `${field.tree_spacing_ft}ft trees`}
            </span>
          </div>
        )}
        {field.trees_per_acre && (
          <div className="flex justify-between text-sm">
            <span className="text-bark-600">Density:</span>
            <span className="font-medium text-heading">{field.trees_per_acre} trees/acre</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-bark-600">County:</span>
          <span className="font-medium text-heading">{field.county || 'Not set'}</span>
        </div>
        {(field.plss_section || field.plss_township || field.plss_range) && (
          <div className="flex justify-between text-sm">
            <span className="text-bark-600">Location:</span>
            <span className="font-medium text-heading text-xs">
              {field.plss_section && `S${field.plss_section}`}
              {field.plss_township && ` T${field.plss_township}`}
              {field.plss_range && ` R${field.plss_range}`}
            </span>
          </div>
        )}
        {field.organic_status && field.organic_status !== 'conventional' && (
          <div className="flex justify-between text-sm">
            <span className="text-bark-600">Organic:</span>
            <span className={`font-medium ${field.organic_status === 'certified' ? 'text-primary' : 'text-yellow-600'}`}>
              {field.organic_status === 'certified' ? 'Certified' : 'Transitional'}
            </span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-bark-600">Applications:</span>
          <span className="font-medium text-link">{applicationCount}</span>
        </div>
        {/* Satellite Tree Detection Data */}
        {field.latest_satellite_tree_count && (
          <div className="mt-2 pt-2 border-t border-border">
            <div className="flex justify-between text-sm">
              <span className="text-bark-600 flex items-center gap-1">
                <TreeDeciduous className="w-3 h-3" />
                Detected Trees:
              </span>
              <span className="font-medium text-primary">
                {field.latest_satellite_tree_count.toLocaleString()}
              </span>
            </div>
            {field.latest_satellite_trees_per_acre && (
              <div className="flex justify-between text-sm">
                <span className="text-bark-600">Trees/Acre:</span>
                <span className="font-medium text-heading">
                  {field.latest_satellite_trees_per_acre.toFixed(1)}
                </span>
              </div>
            )}
            {field.satellite_canopy_coverage_percent && (
              <div className="flex justify-between text-sm">
                <span className="text-bark-600">Canopy:</span>
                <span className="font-medium text-heading">
                  {field.satellite_canopy_coverage_percent.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons - Desktop */}
      <div className="hidden sm:flex gap-2 pt-3 border-t border-border" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => onDrawBoundary(field, farmId)}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-primary-light text-primary rounded hover:bg-green-100 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <MapPin size={14} />
          {hasBoundary ? 'Edit Map' : 'Draw Map'}
        </button>
        {hasBoundary && (
          <>
            <button
              onClick={() => onTreeSummary(field.id)}
              className="flex items-center justify-center gap-1 px-3 py-1.5 bg-cream-100 text-bark-700 rounded hover:bg-sand-200 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-bark-500"
              title="View Satellite Tree Detection"
              aria-label={`View tree detection for ${field.name}`}
            >
              <TreeDeciduous size={14} />
            </button>
            <button
              onClick={() => onLiDARSummary(field.id)}
              className="flex items-center justify-center gap-1 px-3 py-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
              title="View LiDAR Analysis"
              aria-label={`View LiDAR analysis for ${field.name}`}
            >
              <Mountain size={14} />
            </button>
          </>
        )}
        <button
          onClick={() => onEdit(field)}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-orange-50 text-link rounded hover:bg-orange-100 text-sm font-medium transition-colors focus:outline-none focus:ring-[3px] focus:ring-ring"
        >
          <Edit size={14} />
          Edit
        </button>
        <button
          onClick={() => onDelete(field.id)}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-danger-bg text-danger rounded hover:bg-danger-bg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-danger"
        >
          <Trash2 size={14} />
          Delete
        </button>
      </div>

      {/* Action Buttons - Mobile */}
      <div className="flex sm:hidden gap-2 pt-3 border-t border-border" onClick={e => e.stopPropagation()}>
        {/* Primary action: Draw/Edit Map */}
        <button
          onClick={() => onDrawBoundary(field, farmId)}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-primary-light text-primary rounded hover:bg-green-100 text-sm font-medium transition-colors"
        >
          <MapPin size={14} />
          {hasBoundary ? 'Edit Map' : 'Draw Map'}
        </button>

        {/* More actions dropdown */}
        <div className="relative" ref={mobileMenuRef}>
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="p-2 bg-cream-50 text-bark-600 rounded hover:bg-cream-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            title="More actions"
            aria-label={`More actions for ${field.name}`}
            aria-expanded={showMobileMenu}
          >
            <MoreVertical size={16} />
          </button>

          {/* Dropdown Menu */}
          {showMobileMenu && (
            <div className="absolute right-0 bottom-full mb-1 w-44 bg-white rounded-lg shadow-lg border border-border py-1 z-50">
              {hasBoundary && (
                <>
                  <button
                    onClick={() => {
                      onTreeSummary(field.id);
                      setShowMobileMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-bark-700 hover:bg-cream-50 transition-colors"
                  >
                    <TreeDeciduous size={14} className="text-bark-700" />
                    <span>Tree Detection</span>
                  </button>
                  <button
                    onClick={() => {
                      onLiDARSummary(field.id);
                      setShowMobileMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-bark-700 hover:bg-cream-50 transition-colors"
                  >
                    <Mountain size={14} className="text-green-600" />
                    <span>LiDAR Analysis</span>
                  </button>
                  <div className="border-t border-border my-1" />
                </>
              )}
              <button
                onClick={() => {
                  onEdit(field);
                  setShowMobileMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-bark-700 hover:bg-cream-50 transition-colors"
              >
                <Edit size={14} className="text-link" />
                <span>Edit Field</span>
              </button>
              <button
                onClick={() => {
                  onDelete(field.id);
                  setShowMobileMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-danger hover:bg-danger-bg transition-colors"
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

export default React.memo(FieldCard);
