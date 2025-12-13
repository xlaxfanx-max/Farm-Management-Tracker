import React from 'react';
import { Home, Plus, Edit, Trash2 } from 'lucide-react';

function Farms({ farms, fields, onEditFarm, onDeleteFarm, onNewFarm }) {
  // Handle empty data
  if (!farms || !Array.isArray(farms)) farms = [];
  if (!fields || !Array.isArray(fields)) fields = [];
  
  const getFieldCount = (farmId) => {
    return fields.filter(field => field.farm === farmId).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Farms</h2>
          <p className="text-slate-600 mt-1">Manage your farm locations</p>
        </div>
        <button 
          onClick={onNewFarm}
          className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 shadow-lg"
        >
          <Plus size={20} />
          Add Farm
        </button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {farms.map(farm => (
          <div key={farm.id} className="bg-white rounded-lg shadow hover:shadow-xl transition">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="font-bold text-xl text-slate-800">{farm.name}</h3>
                  {farm.farm_number && (
                    <p className="text-sm text-slate-500 font-mono">{farm.farm_number}</p>
                  )}
                </div>
                <Home className="text-green-600 flex-shrink-0" size={28} />
              </div>
              
              <div className="space-y-2 mb-4">
                {farm.owner_name && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Owner:</span>
                    <span className="font-medium text-slate-800">{farm.owner_name}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">County:</span>
                  <span className="font-medium text-slate-800">{farm.county}</span>
                </div>
                {farm.phone && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Phone:</span>
                    <span className="font-medium text-slate-800">{farm.phone}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Fields:</span>
                  <span className="font-medium text-slate-800">{getFieldCount(farm.id)}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <button 
                  onClick={() => onEditFarm(farm)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-sm font-medium"
                >
                  <Edit size={16} />
                  Edit
                </button>
                <button 
                  onClick={() => onDeleteFarm(farm.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-medium"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {farms.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Home className="mx-auto text-slate-300 mb-4" size={48} />
          <h3 className="text-lg font-medium text-slate-800 mb-2">No farms yet</h3>
          <p className="text-slate-600 mb-4">Get started by adding your first farm</p>
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