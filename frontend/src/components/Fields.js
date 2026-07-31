import React from 'react';
import { MapPin, Plus, Edit, Trash2 } from 'lucide-react';

function Fields({ fields, applications, onEditField, onDeleteField, onNewField }) {

  if (!fields || !Array.isArray(fields)) fields = [];
  if (!applications || !Array.isArray(applications)) applications = [];

  const getApplicationCount = (fieldName) => {
    return applications.filter(app => app.field_name === fieldName).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl">Fields</h2>
        <button
          onClick={onNewField}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-hover"
        >
          <Plus size={20} />
          Add Field
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {fields.map(field => (
          <div key={field.id} className="bg-surface-raised rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className=" text-lg">{field.name}</h3>
                <p className="text-sm text-text-secondary">{field.field_number}</p>
              </div>
              <MapPin className="text-primary" size={24} />
            </div>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-bark-600">Crop:</span>
                <span className="font-medium">{field.current_crop}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-bark-600">Acres:</span>
                <span className="font-medium">{field.total_acres}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-bark-600">County:</span>
                <span className="font-medium">{field.county}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-bark-600">Location:</span>
                <span className="font-medium text-xs">
                  {field.plss_section && field.plss_township && field.plss_range
                    ? `S${field.plss_section} T${field.plss_township} R${field.plss_range}`
                    : 'Not set'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-bark-600">Applications:</span>
                <span className="font-medium">{getApplicationCount(field.name)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => onEditField(field)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-orange-50 text-link rounded-lg hover:bg-orange-100 text-sm font-medium"
              >
                <Edit size={16} />
                Edit
              </button>
              <button
                onClick={() => onDeleteField(field.id)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-danger-bg text-danger rounded-lg hover:bg-danger-bg text-sm font-medium"
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Fields;