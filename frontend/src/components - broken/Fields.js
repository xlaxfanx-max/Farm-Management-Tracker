import React from 'react';
import { MapPin, Plus, Edit, Trash2, Leaf } from 'lucide-react';

function Fields({ fields, applications, onEditField, onDeleteField, onNewField }) {

  if (!fields || !Array.isArray(fields)) fields = [];
  if (!applications || !Array.isArray(applications)) applications = [];

  const getApplicationCount = (fieldName) => {
    return applications.filter(app => app.field_name === fieldName).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
              <MapPin className="text-white" size={28} />
            </div>
            Fields
          </h2>
          <p className="text-slate-600 mt-2">Manage your field locations and crop information</p>
        </div>
        <button 
          onClick={onNewField}
          className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl hover:from-green-600 hover:to-emerald-700 font-black shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 hover:scale-105 transition-all duration-300"
        >
          <Plus size={20} />
          Add Field
        </button>
      </div>

      {fields.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-sm border-2 border-dashed border-slate-300">
          <div className="mb-6 flex justify-center">
            <div className="p-6 rounded-full bg-gradient-to-br from-green-100 to-emerald-100">
              <MapPin className="text-green-600" size={48} />
            </div>
          </div>
          <h3 className="text-xl font-black text-slate-800 mb-2">No fields yet</h3>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">Get started by adding your first field to track applications and crop data</p>
          <button 
            onClick={onNewField}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl hover:from-green-600 hover:to-emerald-700 font-black shadow-lg"
          >
            <Plus size={20} />
            Add Your First Field
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {fields.map(field => (
            <div key={field.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-lg transition-all duration-300 overflow-hidden group">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="font-black text-lg text-slate-800 mb-1 group-hover:text-green-600 transition-colors">{field.name}</h3>
                    <p className="text-sm text-slate-500 font-mono font-semibold">{field.field_number}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 shadow-md">
                    <MapPin className="text-white" size={20} />
                  </div>
                </div>
                
                {/* Crop Badge */}
                <div className="mb-4">
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-bold">
                    <Leaf size={14} />
                    {field.current_crop}
                  </span>
                </div>

                <div className="space-y-3 mb-5">
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600 font-semibold">Acres</span>
                    <span className="font-black text-slate-800">{field.total_acres}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600 font-semibold">County</span>
                    <span className="font-bold text-slate-800">{field.county}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600 font-semibold">Location</span>
                    <span className="font-bold text-slate-800 text-xs">
                      {field.section && field.township && field.range_value
                        ? `S${field.section} T${field.township} R${field.range_value}`
                        : 'Not set'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-slate-600 font-semibold">Applications</span>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-black">
                      {getApplicationCount(field.name)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-slate-200">
                  <button 
                    onClick={() => onEditField(field)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 text-sm font-black transition-colors border-2 border-blue-100 hover:border-blue-200"
                  >
                    <Edit size={16} />
                    Edit
                  </button>
                  <button 
                    onClick={() => onDeleteField(field.id)}
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

export default Fields;
