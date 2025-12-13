import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

function FieldModal({ field, farms, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    field_number: '',
    farm: '',
    total_acres: '',
    current_crop: '',
    county: 'Fresno',
    section: '',
    township: '',
    range_value: '',
    planting_date: '',
    gps_lat: '',
    gps_long: ''
  });

  useEffect(() => {
    if (field) {
      setFormData({
        name: field.name,
        field_number: field.field_number,
        farm: field.farm || '',
        total_acres: field.total_acres.toString(),
        current_crop: field.current_crop,
        county: field.county,
        section: field.section || '',
        township: field.township || '',
        range_value: field.range_value || '',
        planting_date: field.planting_date || '',
        gps_lat: field.gps_lat || '',
        gps_long: field.gps_long || ''
      });
    }
  }, [field]);

  const handleSubmit = () => {
    if (!formData.name || !formData.total_acres || !formData.current_crop || !formData.farm) {
      alert('Please fill in all required Farm');
      return;
    }

    const dataToSend = {
      ...formData,
      farm: parseInt(formData.farm),
      total_acres: parseFloat(formData.total_acres),
      gps_lat: formData.gps_lat ? parseFloat(formData.gps_lat) : null,
      gps_long: formData.gps_long ? parseFloat(formData.gps_long) : null,
      planting_date: formData.planting_date || null
    };

    onSave(dataToSend);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-2xl font-bold">{field ? 'Edit Field' : 'Add Field'}</h2>
          <button onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Field Name *</label>
              <input 
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full p-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Field Number *</label>
              <input 
                type="text"
                value={formData.field_number}
                onChange={(e) => setFormData({...formData, field_number: e.target.value})}
                className="w-full p-2 border rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Farm *</label>
            <select 
              value={formData.farm}
              onChange={(e) => setFormData({...formData, farm: e.target.value})}
              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Select farm...</option>
              {farms && farms.map(farm => (
                <option key={farm.id} value={farm.id}>{farm.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Acres *</label>
              <input 
                type="number"
                step="0.01"
                value={formData.total_acres}
                onChange={(e) => setFormData({...formData, total_acres: e.target.value})}
                className="w-full p-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Crop *</label>
              <select 
                value={formData.current_crop}
                onChange={(e) => setFormData({...formData, current_crop: e.target.value})}
                className="w-full p-2 border rounded-lg"
              >
                <option value="">Select...</option>
                <option value="Almonds">Almonds</option>
                <option value="Walnuts">Walnuts</option>
                <option value="Pistachios">Pistachios</option>
                <option value="Grapes">Grapes</option>
                <option value="Oranges">Oranges</option>
                <option value="Tomatoes">Tomatoes</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">County</label>
            <input 
              type="text"
              value={formData.county}
              onChange={(e) => setFormData({...formData, county: e.target.value})}
              className="w-full p-2 border rounded-lg"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Section</label>
              <input 
                type="text"
                value={formData.section}
                onChange={(e) => setFormData({...formData, section: e.target.value})}
                className="w-full p-2 border rounded-lg"
                placeholder="e.g., 12"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Township</label>
              <input 
                type="text"
                value={formData.township}
                onChange={(e) => setFormData({...formData, township: e.target.value})}
                className="w-full p-2 border rounded-lg"
                placeholder="e.g., 15S"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Range</label>
              <input 
                type="text"
                value={formData.range_value}
                onChange={(e) => setFormData({...formData, range_value: e.target.value})}
                className="w-full p-2 border rounded-lg"
                placeholder="e.g., 18E"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Planting Date</label>
            <input 
              type="date"
              value={formData.planting_date}
              onChange={(e) => setFormData({...formData, planting_date: e.target.value})}
              className="w-full p-2 border rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">GPS Latitude</label>
              <input 
                type="text"
                value={formData.gps_lat}
                onChange={(e) => setFormData({...formData, gps_lat: e.target.value})}
                className="w-full p-2 border rounded-lg"
                placeholder="e.g., 36.7378"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">GPS Longitude</label>
              <input 
                type="text"
                value={formData.gps_long}
                onChange={(e) => setFormData({...formData, gps_long: e.target.value})}
                className="w-full p-2 border rounded-lg"
                placeholder="e.g., -119.7871"
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-t flex gap-3 justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 border rounded-lg"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default FieldModal;