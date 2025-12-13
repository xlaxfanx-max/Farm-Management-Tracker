import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

function FarmModal({ farm, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    farm_number: '',
    owner_name: '',
    operator_name: '',
    address: '',
    county: 'Fresno',
    phone: '',
    email: ''
  });

  useEffect(() => {
    if (farm) {
      setFormData({
        name: farm.name,
        farm_number: farm.farm_number || '',
        owner_name: farm.owner_name || '',
        operator_name: farm.operator_name || '',
        address: farm.address || '',
        county: farm.county,
        phone: farm.phone || '',
        email: farm.email || ''
      });
    }
  }, [farm]);

  const handleSubmit = () => {
    if (!formData.name || !formData.county) {
      alert('Please fill in Farm Name and County');
      return;
    }

    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-2xl font-bold">{farm ? 'Edit Farm' : 'Add Farm'}</h2>
          <button onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Farm Name *</label>
              <input 
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full p-2 border rounded-lg"
                placeholder="e.g., Foster Park"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Farm Number</label>
              <input 
                type="text"
                value={formData.farm_number}
                onChange={(e) => setFormData({...formData, farm_number: e.target.value})}
                className="w-full p-2 border rounded-lg"
                placeholder="e.g., FP-001"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Owner Name</label>
              <input 
                type="text"
                value={formData.owner_name}
                onChange={(e) => setFormData({...formData, owner_name: e.target.value})}
                className="w-full p-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Operator Name</label>
              <input 
                type="text"
                value={formData.operator_name}
                onChange={(e) => setFormData({...formData, operator_name: e.target.value})}
                className="w-full p-2 border rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Address</label>
            <textarea 
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              className="w-full p-2 border rounded-lg"
              rows="2"
              placeholder="Street address, city, state, zip"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">County *</label>
            <input 
              type="text"
              value={formData.county}
              onChange={(e) => setFormData({...formData, county: e.target.value})}
              className="w-full p-2 border rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input 
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full p-2 border rounded-lg"
                placeholder="555-1234"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input 
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full p-2 border rounded-lg"
                placeholder="farm@example.com"
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-t flex gap-3 justify-end bg-slate-50">
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

export default FarmModal;