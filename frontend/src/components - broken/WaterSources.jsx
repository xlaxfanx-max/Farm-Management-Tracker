import React, { useState } from 'react';
import { Droplet, Plus, AlertCircle, CheckCircle, Clock, MapPin, Edit } from 'lucide-react';

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
    if (!source.active) {
      return { status: 'inactive', label: 'Inactive', icon: AlertCircle, color: 'text-gray-500', bgColor: 'bg-gray-100' };
    }
    return { status: 'active', label: 'Active', icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100' };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg">
              <Droplet className="text-white" size={28} />
            </div>
            Water Sources
          </h2>
          <p className="text-slate-600 mt-2">Manage irrigation and wash water sources</p>
        </div>
        <button
          onClick={onNewSource}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl hover:from-blue-600 hover:to-cyan-700 font-black shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-105 transition-all duration-300"
        >
          <Plus size={20} />
          Add Water Source
        </button>
      </div>

      {/* Farm Filter */}
      {farms.length > 1 && (
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
          <label className="block text-sm font-black text-slate-700 mb-2">
            Filter by Farm
          </label>
          <select
            value={selectedFarm}
            onChange={(e) => setSelectedFarm(e.target.value)}
            className="w-full md:w-64 px-3 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-semibold"
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
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center border-2 border-dashed border-slate-300">
          <div className="mb-6 flex justify-center">
            <div className="p-6 rounded-full bg-gradient-to-br from-blue-100 to-cyan-100">
              <Droplet className="text-blue-600" size={48} />
            </div>
          </div>
          <h3 className="text-xl font-black text-slate-800 mb-2">No Water Sources</h3>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            {selectedFarm === 'all' 
              ? "Get started by adding your first water source."
              : "No water sources found for this farm."}
          </p>
          <button
            onClick={onNewSource}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl hover:from-blue-600 hover:to-cyan-700 font-black shadow-lg"
          >
            Add Water Source
          </button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSources.map(source => {
            const status = getTestStatus(source);
            const StatusIcon = status.icon;
            const farm = farms.find(f => f.id === source.farm);

            return (
              <div key={source.id} className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 border border-slate-200 overflow-hidden group">
                <div className="h-2 bg-gradient-to-r from-blue-500 to-cyan-600"></div>
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-lg text-slate-800 mb-1 group-hover:text-blue-600 transition-colors truncate">{source.name}</h3>
                      <p className="text-sm text-slate-600 font-semibold">{farm?.name}</p>
                    </div>
                    <div className={`p-2 rounded-lg ${status.bgColor} flex-shrink-0`}>
                      <StatusIcon className={status.color} size={20} />
                    </div>
                  </div>

                  {/* Source Type Badge */}
                  <div className="mb-4">
                    <span className="inline-block px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-black rounded-full">
                      {getSourceTypeLabel(source.source_type)}
                    </span>
                  </div>

                  {/* Usage */}
                  <div className="mb-4">
                    <p className="text-xs text-slate-500 font-bold mb-2">Used for:</p>
                    <div className="flex flex-wrap gap-2">
                      {getUsageLabels(source).map(use => (
                        <span key={use} className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded font-bold">
                          {use}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Location */}
                  {source.location_description && (
                    <div className="mb-4 flex items-start gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <MapPin size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-slate-600 line-clamp-2 font-medium">{source.location_description}</p>
                    </div>
                  )}

                  {/* Test Frequency */}
                  <div className="mb-5 flex items-center gap-2 text-sm text-slate-600 font-semibold">
                    <Clock size={14} className="text-slate-400" />
                    <span>Tests every {source.test_frequency_days} days</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t border-slate-200">
                    <button
                      onClick={() => onViewTests(source)}
                      className="flex-1 px-3 py-2.5 text-sm text-white bg-gradient-to-r from-blue-500 to-cyan-600 rounded-xl hover:from-blue-600 hover:to-cyan-700 font-black transition-all"
                    >
                      View Tests
                    </button>
                    <button
                      onClick={() => onEditSource(source)}
                      className="px-3 py-2.5 text-sm text-blue-600 border-2 border-blue-200 bg-blue-50 rounded-xl hover:bg-blue-100 font-black transition-colors"
                    >
                      <Edit size={16} />
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