import React, { useState, useRef, useEffect } from 'react';
import { Home, Plus, Edit, Trash2, MapPin, ChevronDown, ChevronRight, Locate, Satellite, MoreVertical } from 'lucide-react';
import QuarantineStatusBadge from './QuarantineStatusBadge';
import FieldCard from './FieldCard';

/**
 * FarmCard component - Displays a single farm with its fields
 *
 * @param {Object} props
 * @param {Object} props.farm - Farm data object
 * @param {Array} props.fields - Array of fields for this farm
 * @param {Object} props.stats - Pre-calculated farm statistics
 * @param {boolean} props.isExpanded - Whether fields section is expanded
 * @param {boolean} props.isSelected - Whether this farm is selected
 * @param {Function} props.onToggleExpand - Callback when expand/collapse clicked
 * @param {Function} props.onEdit - Callback when edit button clicked
 * @param {Function} props.onDelete - Callback when delete button clicked
 * @param {Function} props.onAddField - Callback when add field clicked
 * @param {Function} props.onGeocode - Callback when get GPS clicked
 * @param {Function} props.onUploadImagery - Callback when imagery button clicked
 * @param {boolean} props.isGeocoding - Whether geocoding is in progress
 * @param {number|null} props.selectedFieldId - Currently selected field ID
 * @param {Function} props.onFieldSelect - Callback when field is selected
 * @param {Function} props.onFieldEdit - Callback when field edit clicked
 * @param {Function} props.onFieldDelete - Callback when field delete clicked
 * @param {Function} props.onFieldDrawBoundary - Callback when draw boundary clicked
 * @param {Function} props.onFieldTreeSummary - Callback when tree summary clicked
 * @param {Function} props.onFieldLiDARSummary - Callback when LiDAR summary clicked
 * @param {Function} props.getFieldApplicationCount - Function to get application count for a field
 */
function FarmCard({
  farm,
  fields,
  stats,
  isExpanded,
  isSelected,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddField,
  onGeocode,
  onUploadImagery,
  isGeocoding,
  selectedFieldId,
  onFieldSelect,
  onFieldEdit,
  onFieldDelete,
  onFieldDrawBoundary,
  onFieldTreeSummary,
  onFieldLiDARSummary,
  getFieldApplicationCount
}) {
  const hasCoords = farm.gps_latitude && farm.gps_longitude;
  const ExpandIcon = isExpanded ? ChevronDown : ChevronRight;

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
      className={`bg-white rounded-lg shadow-md border-2 overflow-hidden transition-all ${
        isSelected ? 'border-green-500 shadow-lg' : 'border-gray-200'
      }`}
    >
      {/* Farm Header */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 border-b border-gray-200">
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <button
                  onClick={() => onToggleExpand(farm.id)}
                  className="p-1 hover:bg-white rounded transition-colors"
                >
                  <ExpandIcon className="w-6 h-6 text-gray-700" />
                </button>
                <Home className="text-green-600 flex-shrink-0" size={32} />
                <div>
                  <h3 className="font-bold text-2xl text-gray-900">{farm.name}</h3>
                  {farm.farm_number && (
                    <p className="text-sm text-gray-600 font-mono mt-1">{farm.farm_number}</p>
                  )}
                </div>

                {/* GPS Status Badge */}
                <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                  hasCoords
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {hasCoords ? '📍 Mapped' : 'No GPS'}
                </span>

                {/* HLB Quarantine Status Badge */}
                {hasCoords && (
                  <QuarantineStatusBadge
                    farmId={farm.id}
                    compact={false}
                    showRefresh={true}
                  />
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 ml-10">
                {farm.owner_name && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Owner</p>
                    <p className="font-medium text-gray-900">{farm.owner_name}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">County</p>
                  <p className="font-medium text-gray-900">{farm.county}</p>
                </div>
                {farm.phone && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Phone</p>
                    <p className="font-medium text-gray-900">{farm.phone}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Fields</p>
                  <p className="font-medium text-gray-900">{fields.length} field{fields.length !== 1 ? 's' : ''}</p>
                </div>
              </div>

              {/* Farm Stats Strip */}
              {fields.length > 0 && (
                <div className="mt-4 ml-10 pt-3 border-t border-gray-200/50">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white/60 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-500">Total Acres</p>
                      <p className="text-lg font-bold text-gray-900">{stats.totalAcres.toFixed(1)}</p>
                    </div>
                    <div className="bg-white/60 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-500">Mapped Fields</p>
                      <p className="text-lg font-bold text-gray-900">
                        <span className={stats.mappedFields === stats.fieldCount ? 'text-green-600' : 'text-amber-600'}>
                          {stats.mappedFields}
                        </span>
                        <span className="text-gray-400 text-sm">/{stats.fieldCount}</span>
                      </p>
                    </div>
                    <div className="bg-white/60 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-500">Applications</p>
                      <p className="text-lg font-bold text-blue-600">{stats.totalApplications}</p>
                    </div>
                    {stats.topCrop && (
                      <div className="bg-white/60 rounded-lg px-3 py-2">
                        <p className="text-xs text-gray-500">Top Crop</p>
                        <p className="text-sm font-medium text-gray-900 truncate">{stats.topCrop}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons - Desktop */}
            <div className="hidden md:flex gap-2 ml-4">
              {/* Get GPS Button */}
              {!hasCoords && (
                <button
                  onClick={() => onGeocode(farm)}
                  disabled={isGeocoding}
                  className={`flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg transition-colors ${
                    isGeocoding
                      ? 'bg-gray-100 text-gray-400'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                  title="Get GPS from address"
                >
                  <Locate size={18} className={isGeocoding ? 'animate-pulse' : ''} />
                  <span>{isGeocoding ? 'Finding...' : 'Get GPS'}</span>
                </button>
              )}

              <button
                onClick={() => onUploadImagery(farm.id)}
                className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
                title="Upload Satellite Imagery"
              >
                <Satellite size={18} />
                <span>Imagery</span>
              </button>
              <button
                onClick={() => onAddField(farm.id)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                title="Add Field to this Farm"
              >
                <Plus size={18} />
                <span>Add Field</span>
              </button>
              <button
                onClick={() => onEdit(farm)}
                className="p-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                title="Edit Farm"
              >
                <Edit size={18} />
              </button>
              <button
                onClick={() => onDelete(farm.id)}
                className="p-2 bg-white border border-gray-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                title="Delete Farm"
              >
                <Trash2 size={18} />
              </button>
            </div>

            {/* Action Buttons - Mobile */}
            <div className="flex md:hidden gap-2 ml-4">
              {/* Primary action: Add Field */}
              <button
                onClick={() => onAddField(farm.id)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                title="Add Field to this Farm"
              >
                <Plus size={18} />
                <span className="sr-only sm:not-sr-only">Add Field</span>
              </button>

              {/* More actions dropdown */}
              <div className="relative" ref={mobileMenuRef}>
                <button
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  className="p-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  title="More actions"
                >
                  <MoreVertical size={18} />
                </button>

                {/* Dropdown Menu */}
                {showMobileMenu && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    {!hasCoords && (
                      <button
                        onClick={() => {
                          onGeocode(farm);
                          setShowMobileMenu(false);
                        }}
                        disabled={isGeocoding}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Locate size={16} className={isGeocoding ? 'animate-pulse' : ''} />
                        <span>{isGeocoding ? 'Finding GPS...' : 'Get GPS'}</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        onUploadImagery(farm.id);
                        setShowMobileMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Satellite size={16} className="text-purple-600" />
                      <span>Upload Imagery</span>
                    </button>
                    <button
                      onClick={() => {
                        onEdit(farm);
                        setShowMobileMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Edit size={16} />
                      <span>Edit Farm</span>
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <button
                      onClick={() => {
                        onDelete(farm.id);
                        setShowMobileMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={16} />
                      <span>Delete Farm</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fields Section (Expandable) */}
      {isExpanded && (
        <div className="p-6 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              Fields ({fields.length})
            </h4>
            <button
              onClick={() => onAddField(farm.id)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm transition-colors"
            >
              <Plus size={16} />
              Add Field to {farm.name}
            </button>
          </div>

          {fields.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-lg border-2 border-dashed border-gray-300">
              <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 mb-3">No fields yet for this farm</p>
              <button
                onClick={() => onAddField(farm.id)}
                className="text-blue-600 hover:text-blue-700 font-medium text-sm"
              >
                Add your first field →
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {fields.map(field => (
                <FieldCard
                  key={field.id}
                  field={field}
                  farmId={farm.id}
                  isSelected={selectedFieldId === field.id}
                  applicationCount={getFieldApplicationCount(field.id, field.name)}
                  onSelect={onFieldSelect}
                  onEdit={onFieldEdit}
                  onDelete={onFieldDelete}
                  onDrawBoundary={onFieldDrawBoundary}
                  onTreeSummary={onFieldTreeSummary}
                  onLiDARSummary={onFieldLiDARSummary}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FarmCard;
