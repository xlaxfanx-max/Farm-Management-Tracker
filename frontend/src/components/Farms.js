import React, { useState } from 'react';
import { Home, Plus, Edit, Trash2, MapPin, ChevronDown, ChevronRight, Sprout } from 'lucide-react';

function Farms({ farms, fields, applications, onNewFarm, onEditFarm, onDeleteFarm, onNewField, onEditField, onDeleteField }) {
  const [expandedFarms, setExpandedFarms] = useState(new Set());

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
    return fields.filter(field => field.farm === farmId);
  };

  const getFieldApplicationCount = (fieldName) => {
    return applications.filter(app => app.field_name === fieldName).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Farms & Fields</h2>
          <p className="text-gray-600 mt-1">Manage your farm locations and fields</p>
        </div>
        <button 
          onClick={onNewFarm}
          className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 shadow-lg transition-colors"
        >
          <Plus size={20} />
          Add Farm
        </button>
      </div>

      <div className="space-y-4">
        {farms.map(farm => {
          const farmFields = getFarmFields(farm.id);
          const isExpanded = expandedFarms.has(farm.id);
          const ExpandIcon = isExpanded ? ChevronDown : ChevronRight;

          return (
            <div key={farm.id} className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
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
                      <button 
                        onClick={() => onNewField()}
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
                      onClick={onNewField}
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
                        onClick={onNewField}
                        className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                      >
                        Add your first field →
                      </button>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {farmFields.map(field => (
                        <div key={field.id} className="bg-white rounded-lg shadow border border-gray-200 p-4 hover:shadow-md transition-shadow">
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
                            <MapPin className="text-blue-600 flex-shrink-0" size={20} />
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
                              <span className="font-medium text-blue-600">{getFieldApplicationCount(field.name)}</span>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-3 border-t border-gray-100">
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
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

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
  );
}

export default Farms;