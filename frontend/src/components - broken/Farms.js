import React from 'react';
import { Home, Plus, Edit, Trash2, MapPin, Phone, Mail } from 'lucide-react';

function Farms({ farms, fields, onEditFarm, onDeleteFarm, onNewFarm }) {
  // Handle empty data
  if (!farms || !Array.isArray(farms)) farms = [];
  if (!fields || !Array.isArray(fields)) fields = [];
  
  const getFieldCount = (farmId) => {
    return fields.filter(field => field.farm === farmId).length;
  };

  const getTotalAcres = (farmId) => {
    return fields
      .filter(field => field.farm === farmId)
      .reduce((sum, field) => sum + (field.total_acres || 0), 0)
      .toFixed(2);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg">
              <Home className="text-white" size={28} />
            </div>
            Farms
          </h2>
          <p className="text-slate-600 mt-2">Manage your farm locations and operations</p>
        </div>
        <button 
          onClick={onNewFarm}
          className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white px-6 py-3 rounded-xl hover:from-amber-600 hover:to-orange-700 font-black shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 hover:scale-105 transition-all duration-300"
        >
          <Plus size={20} />
          Add Farm
        </button>
      </div>

      {farms.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-sm border-2 border-dashed border-slate-300">
          <div className="mb-6 flex justify-center">
            <div className="p-6 rounded-full bg-gradient-to-br from-orange-100 to-amber-100">
              <Home className="text-orange-600" size={48} />
            </div>
          </div>
          <h3 className="text-xl font-black text-slate-800 mb-2">No farms yet</h3>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">Get started by adding your first farm location to organize your operations</p>
          <button 
            onClick={onNewFarm}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white px-6 py-3 rounded-xl hover:from-amber-600 hover:to-orange-700 font-black shadow-lg"
          >
            <Plus size={20} />
            Add Your First Farm
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {farms.map(farm => (
            <div key={farm.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-lg transition-all duration-300 overflow-hidden group">
              <div className="h-2 bg-gradient-to-r from-amber-500 to-orange-600"></div>
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-xl text-slate-800 mb-1 group-hover:text-orange-600 transition-colors truncate">{farm.name}</h3>
                    {farm.farm_number && (
                      <p className="text-sm text-slate-500 font-mono font-bold">{farm.farm_number}</p>
                    )}
                  </div>
                  <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-md flex-shrink-0">
                    <Home className="text-white" size={20} />
                  </div>
                </div>
                
                <div className="space-y-3 mb-5">
                  {farm.owner_name && (
                    <div className="flex items-start gap-2 py-2 border-b border-slate-100">
                      <span className="text-sm text-slate-600 font-semibold min-w-[80px]">Owner</span>
                      <span className="font-bold text-slate-800 text-sm flex-1">{farm.owner_name}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-2 py-2 border-b border-slate-100">
                    <MapPin size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />
                    <span className="font-bold text-slate-800 text-sm">{farm.county} County</span>
                  </div>
                  {farm.phone && (
                    <div className="flex items-center gap-2 py-2 border-b border-slate-100">
                      <Phone size={16} className="text-slate-400 flex-shrink-0" />
                      <span className="font-bold text-slate-800 text-sm">{farm.phone}</span>
                    </div>
                  )}
                  {farm.email && (
                    <div className="flex items-center gap-2 py-2 border-b border-slate-100">
                      <Mail size={16} className="text-slate-400 flex-shrink-0" />
                      <span className="font-bold text-slate-800 text-sm truncate">{farm.email}</span>
                    </div>
                  )}
                  
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                      <div className="text-xs text-green-600 font-bold mb-1">Fields</div>
                      <div className="text-2xl font-black text-green-700">{getFieldCount(farm.id)}</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                      <div className="text-xs text-blue-600 font-bold mb-1">Total Acres</div>
                      <div className="text-2xl font-black text-blue-700">{getTotalAcres(farm.id)}</div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-slate-200">
                  <button 
                    onClick={() => onEditFarm(farm)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 text-sm font-black transition-colors border-2 border-blue-100 hover:border-blue-200"
                  >
                    <Edit size={16} />
                    Edit
                  </button>
                  <button 
                    onClick={() => onDeleteFarm(farm.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 text-sm font-black transition-colors border-2 border-red-100 hover:border-red-200"
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Farms;
