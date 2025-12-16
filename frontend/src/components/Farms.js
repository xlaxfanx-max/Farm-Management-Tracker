import React, { useState } from 'react';
import { Home, Plus, Edit, Trash2, MapPin, ChevronDown, ChevronRight, Sprout, Map, Grid3X3, Layers, Locate } from 'lucide-react';
import FarmMap from './FarmMap';
import { mapAPI } from '../services/api';

function Farms({ farms, fields, applications, onNewFarm, onEditFarm, onDeleteFarm, onNewField, onEditField, onDeleteField, onRefresh }) {
  const [expandedFarms, setExpandedFarms] = useState(new Set());
  const [viewMode, setViewMode] = useState('cards'); // 'cards', 'map', 'split'
  const [selectedFarmId, setSelectedFarmId] = useState(null);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [geocodingFarmId, setGeocodingFarmId] = useState(null);
  const [drawingField, setDrawingField] = useState(null); // { id, name } - field to start drawing for

  // Handle empty data
  if (!farms || !Array.isArray(farms)) farms = [];
  if (!fields || !Array.isArray(fields)) fields = [];
  if (!applications || !Array.isArray(applications)) applications = [];
  
  const toggleFarm = (farmId) => {
    const newExpanded = new Set(expandedFarms);
    if (newExpanded.has(farmId)) {
      newExpanded.delete(farmId);
    } else {
      newExpanded.add(farmId);
    }
    setExpandedFarms(newExpanded);
  };

  const getFarmFields = (farmId) => {
    return fields.filter(field => {
      const fieldFarmId = parseInt(field.farm);
      const compareFarmId = parseInt(farmId);
      return fieldFarmId === compareFarmId;
    });
  };

  const getFieldApplicationCount = (fieldId, fieldName) => {
    return applications.filter(app => 
      app.field === fieldId || app.field_name === fieldName
    ).length;
  };

  // Handle farm selection from map
  const handleFarmSelect = (farmId) => {
    setSelectedFarmId(farmId);
    setSelectedFieldId(null);
    // Expand the farm
    setExpandedFarms(prev => new Set([...prev, farmId]));
  };

  // Handle field selection from map
  const handleFieldSelect = (fieldId) => {
    setSelectedFieldId(fieldId);
    const field = fields.find(f => f.id === fieldId);
    if (field) {
      setSelectedFarmId(parseInt(field.farm));
      setExpandedFarms(prev => new Set([...prev, parseInt(field.farm)]));
    }
  };

  // Handle boundary update from map
  const handleBoundaryUpdate = async (fieldId, geojson, acres) => {
    console.log('[Farms] handleBoundaryUpdate called:', { fieldId, geojson, acres });
    try {
      const response = await mapAPI.updateFieldBoundary(fieldId, geojson, acres);
      console.log('[Farms] Boundary update response:', response.data);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('[Farms] Error saving boundary:', err);
      alert('Failed to save field boundary');
    }
  };

  // Geocode farm address
  const handleGeocodeFarm = async (farm) => {
    if (!farm.address && !farm.county) {
      alert('Farm needs an address or county to get GPS coordinates');
      return;
    }
    
    setGeocodingFarmId(farm.id);
    try {
      const address = `${farm.address || ''}, ${farm.county} County, California`;
      const response = await mapAPI.geocode(address);
      
      if (response.data && response.data.lat) {
        // Update farm with new coordinates via edit
        const updatedFarm = {
          ...farm,
          gps_lat: response.data.lat,
          gps_long: response.data.lng
        };
        onEditFarm(updatedFarm, true); // Pass true to indicate auto-save
      }
    } catch (err) {
      console.error('Geocoding error:', err);
      alert('Could not find coordinates for this address');
    } finally {
      setGeocodingFarmId(null);
    }
  };

  // Stats
  const farmsWithCoords = farms.filter(f => f.gps_lat && f.gps_long).length;
  const fieldsWithBoundaries = fields.filter(f => f.boundary_geojson).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Farms & Fields</h2>
          <p className="text-gray-600 mt-1">
            {farms.length} farms · {fields.length} fields
            {farmsWithCoords > 0 && ` · ${farmsWithCoords} mapped`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('cards')}
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
              onClick={() => setViewMode('map')}
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
              onClick={() => setViewMode('split')}
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
            onClick={onNewFarm}
            className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 shadow-lg transition-colors"
          >
            <Plus size={20} />
            Add Farm
          </button>
        </div>
      </div>

      {/* Map Hint */}
      {viewMode === 'cards' && farmsWithCoords === 0 && farms.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <MapPin className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800">Add GPS coordinates to see farms on the map</p>
            <p className="text-sm text-blue-600 mt-1">
              Click the <Locate className="w-4 h-4 inline" /> button on a farm to get coordinates from its address, 
              or switch to Map view to see the satellite view.
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={viewMode === 'split' ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : ''}>
        
        {/* Map View */}
        {(viewMode === 'map' || viewMode === 'split') && (
          <div className={viewMode === 'split' ? 'order-2' : ''}>
            <FarmMap
              farms={farms}
              fields={fields}
              selectedFarmId={selectedFarmId}
              selectedFieldId={selectedFieldId}
              onFarmSelect={handleFarmSelect}
              onFieldSelect={handleFieldSelect}
              onBoundaryUpdate={handleBoundaryUpdate}
              height={viewMode === 'map' ? '600px' : '500px'}
              drawingField={drawingField}
              onDrawingComplete={() => setDrawingField(null)}
            />
            
            {fieldsWithBoundaries < fields.length && fields.length > 0 && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                <strong>💡 Tip:</strong> {fields.length - fieldsWithBoundaries} of {fields.length} fields need boundaries drawn. 
                Click on a field marker to draw its boundary.
              </div>
            )}
          </div>
        )}

        {/* Card View */}
        {(viewMode === 'cards' || viewMode === 'split') && (
          <div className={`space-y-4 ${viewMode === 'split' ? 'order-1' : ''}`}>
            {farms.map(farm => {
              const farmFields = getFarmFields(farm.id);
              const isExpanded = expandedFarms.has(farm.id);
              const isSelected = selectedFarmId === farm.id;
              const hasCoords = farm.gps_lat && farm.gps_long;
              const ExpandIcon = isExpanded ? ChevronDown : ChevronRight;

              return (
                <div 
                  key={farm.id} 
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
                              onClick={() => toggleFarm(farm.id)}
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
                              <p className="font-medium text-gray-900">{farmFields.length} field{farmFields.length !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 ml-4">
                          {/* Get GPS Button */}
                          {!hasCoords && (
                            <button 
                              onClick={() => handleGeocodeFarm(farm)}
                              disabled={geocodingFarmId === farm.id}
                              className={`flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg transition-colors ${
                                geocodingFarmId === farm.id 
                                  ? 'bg-gray-100 text-gray-400' 
                                  : 'bg-white text-gray-700 hover:bg-gray-50'
                              }`}
                              title="Get GPS from address"
                            >
                              <Locate size={18} className={geocodingFarmId === farm.id ? 'animate-pulse' : ''} />
                              <span className="hidden sm:inline">
                                {geocodingFarmId === farm.id ? 'Finding...' : 'Get GPS'}
                              </span>
                            </button>
                          )}
                          
                          <button 
                            onClick={() => onNewField(farm.id)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                            title="Add Field to this Farm"
                          >
                            <Plus size={18} />
                            <span>Add Field</span>
                          </button>
                          <button 
                            onClick={() => onEditFarm(farm)}
                            className="p-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                            title="Edit Farm"
                          >
                            <Edit size={18} />
                          </button>
                          <button 
                            onClick={() => onDeleteFarm(farm.id)}
                            className="p-2 bg-white border border-gray-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                            title="Delete Farm"
                          >
                            <Trash2 size={18} />
                          </button>
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
                          Fields ({farmFields.length})
                        </h4>
                        <button
                          onClick={() => onNewField(farm.id)}
                          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm transition-colors"
                        >
                          <Plus size={16} />
                          Add Field to {farm.name}
                        </button>
                      </div>

                      {farmFields.length === 0 ? (
                        <div className="text-center py-8 bg-white rounded-lg border-2 border-dashed border-gray-300">
                          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-600 mb-3">No fields yet for this farm</p>
                          <button
                            onClick={() => onNewField(farm.id)}
                            className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                          >
                            Add your first field →
                          </button>
                        </div>
                      ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {farmFields.map(field => {
                            const isFieldSelected = selectedFieldId === field.id;
                            const hasBoundary = !!field.boundary_geojson;
                            
                            return (
                              <div 
                                key={field.id} 
                                className={`bg-white rounded-lg shadow border-2 p-4 hover:shadow-md transition-all cursor-pointer ${
                                  isFieldSelected ? 'border-blue-500' : 'border-gray-200'
                                }`}
                                onClick={() => handleFieldSelect(field.id)}
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Sprout className="w-4 h-4 text-green-600" />
                                      <h5 className="font-bold text-gray-900">{field.name}</h5>
                                    </div>
                                    {field.field_number && (
                                      <p className="text-xs text-gray-500 font-mono">{field.field_number}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {hasBoundary ? (
                                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                                        Mapped
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                                        No boundary
                                      </span>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="space-y-2 mb-4">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Crop:</span>
                                    <span className="font-medium text-gray-900">{field.current_crop || 'Not set'}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Acres:</span>
                                    <span className="font-medium text-gray-900">{field.total_acres || '0'}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">County:</span>
                                    <span className="font-medium text-gray-900">{field.county || 'Not set'}</span>
                                  </div>
                                  {(field.section || field.township || field.range_value) && (
                                    <div className="flex justify-between text-sm">
                                      <span className="text-gray-600">Location:</span>
                                      <span className="font-medium text-gray-900 text-xs">
                                        {field.section && `S${field.section}`}
                                        {field.township && ` T${field.township}`}
                                        {field.range_value && ` R${field.range_value}`}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Applications:</span>
                                    <span className="font-medium text-blue-600">{getFieldApplicationCount(field.id, field.name)}</span>
                                  </div>
                                </div>

                                <div className="flex gap-2 pt-3 border-t border-gray-100" onClick={e => e.stopPropagation()}>
                                  <button 
                                    onClick={() => {
                                      setViewMode('map');
                                      setSelectedFieldId(field.id);
                                      // Small delay to let map render, then trigger drawing
                                      setTimeout(() => {
                                        setDrawingField({ id: field.id, name: field.name });
                                      }, 300);
                                    }}
                                    className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100 text-sm font-medium transition-colors"
                                  >
                                    <MapPin size={14} />
                                    {hasBoundary ? 'Edit Map' : 'Draw Map'}
                                  </button>
                                  <button 
                                    onClick={() => onEditField(field)}
                                    className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 text-sm font-medium transition-colors"
                                  >
                                    <Edit size={14} />
                                    Edit
                                  </button>
                                  <button 
                                    onClick={() => onDeleteField(field.id)}
                                    className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 text-sm font-medium transition-colors"
                                  >
                                    <Trash2 size={14} />
                                    Delete
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {farms.length === 0 && (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <Home className="mx-auto text-gray-300 mb-4" size={48} />
                <h3 className="text-lg font-medium text-gray-800 mb-2">No farms yet</h3>
                <p className="text-gray-600 mb-4">Get started by adding your first farm</p>
                <button 
                  onClick={onNewFarm}
                  className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"
                >
                  <Plus size={20} />
                  Add Your First Farm
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Farms;
