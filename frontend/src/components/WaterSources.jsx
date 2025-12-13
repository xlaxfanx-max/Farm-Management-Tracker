import React, { useState } from 'react';
import { Droplet, Plus, AlertCircle, CheckCircle, Clock, MapPin } from 'lucide-react';

function WaterSources({ waterSources, farms, onEditSource, onDeleteSource, onNewSource, onViewTests }) {
  const [selectedFarm, setSelectedFarm] = useState('all');

  const filteredSources = selectedFarm === 'all' 
    ? waterSources 
    : waterSources.filter(source => source.farm === parseInt(selectedFarm));

  const getSourceTypeLabel = (type) => {
    const types = {
      'well': 'Well',
      'municipal': 'Municipal/Public',
      'surface': 'Surface Water',
      'other': 'Other'
    };
    return types[type] || type;
  };

  const getUsageLabels = (source) => {
    const uses = [];
    if (source.used_for_irrigation) uses.push('Irrigation');
    if (source.used_for_washing) uses.push('Washing');
    if (source.used_for_pesticide_mixing) uses.push('Pesticide Mixing');
    return uses;
  };

  const getTestStatus = (source) => {
    // This would ideally come from the backend
    // For now, we'll show a basic status
    if (!source.active) {
      return { status: 'inactive', label: 'Inactive', icon: AlertCircle, color: 'text-gray-500' };
    }
    // You can add logic here to check if tests are overdue
    return { status: 'active', label: 'Active', icon: CheckCircle, color: 'text-green-600' };
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Droplet className="text-blue-600" />
            Water Sources
          </h2>
          <p className="text-slate-600 mt-1">Manage irrigation and wash water sources</p>
        </div>
        <button
          onClick={onNewSource}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          Add Water Source
        </button>
      </div>

      {/* Farm Filter */}
      {farms.length > 1 && (
        <div className="mb-6 bg-white rounded-lg shadow-sm p-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Filter by Farm
          </label>
          <select
            value={selectedFarm}
            onChange={(e) => setSelectedFarm(e.target.value)}
            className="w-full md:w-64 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Farms</option>
            {farms.map(farm => (
              <option key={farm.id} value={farm.id}>{farm.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Water Sources Grid */}
      {filteredSources.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <Droplet size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No Water Sources</h3>
          <p className="text-slate-600 mb-6">
            {selectedFarm === 'all' 
              ? "Get started by adding your first water source."
              : "No water sources found for this farm."}
          </p>
          <button
            onClick={onNewSource}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add Water Source
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSources.map(source => {
            const status = getTestStatus(source);
            const StatusIcon = status.icon;
            const farm = farms.find(f => f.id === source.farm);

            return (
              <div key={source.id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <div className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900 text-lg">{source.name}</h3>
                      <p className="text-sm text-slate-600">{farm?.name}</p>
                    </div>
                    <StatusIcon className={`${status.color} flex-shrink-0`} size={20} />
                  </div>

                  {/* Source Type */}
                  <div className="mb-3">
                    <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                      {getSourceTypeLabel(source.source_type)}
                    </span>
                  </div>

                  {/* Usage */}
                  <div className="mb-3">
                    <p className="text-xs text-slate-500 mb-1">Used for:</p>
                    <div className="flex flex-wrap gap-1">
                      {getUsageLabels(source).map(use => (
                        <span key={use} className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                          {use}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Location */}
                  {source.location_description && (
                    <div className="mb-3 flex items-start gap-2">
                      <MapPin size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-slate-600 line-clamp-2">{source.location_description}</p>
                    </div>
                  )}

                  {/* Test Frequency */}
                  <div className="mb-4 flex items-center gap-2 text-xs text-slate-600">
                    <Clock size={14} className="text-slate-400" />
                    <span>Tests every {source.test_frequency_days} days</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => onViewTests(source)}
                      className="flex-1 px-3 py-1.5 text-sm text-blue-600 border border-blue-600 rounded hover:bg-blue-50"
                    >
                      View Tests
                    </button>
                    <button
                      onClick={() => onEditSource(source)}
                      className="flex-1 px-3 py-1.5 text-sm text-slate-700 border border-slate-300 rounded hover:bg-slate-50"
                    >
                      Edit
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
}

export default WaterSources;
