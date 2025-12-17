import React, { useState, useEffect } from 'react';
import { X, Building2, MapPin, Users } from 'lucide-react';
import api from '../services/api';
import FarmParcelManager from './FarmParcelManager';

// California counties for dropdown
const CA_COUNTIES = [
  'Alameda', 'Alpine', 'Amador', 'Butte', 'Calaveras', 'Colusa', 'Contra Costa',
  'Del Norte', 'El Dorado', 'Fresno', 'Glenn', 'Humboldt', 'Imperial', 'Inyo',
  'Kern', 'Kings', 'Lake', 'Lassen', 'Los Angeles', 'Madera', 'Marin', 'Mariposa',
  'Mendocino', 'Merced', 'Modoc', 'Mono', 'Monterey', 'Napa', 'Nevada', 'Orange',
  'Placer', 'Plumas', 'Riverside', 'Sacramento', 'San Benito', 'San Bernardino',
  'San Diego', 'San Francisco', 'San Joaquin', 'San Luis Obispo', 'San Mateo',
  'Santa Barbara', 'Santa Clara', 'Santa Cruz', 'Shasta', 'Sierra', 'Siskiyou',
  'Solano', 'Sonoma', 'Stanislaus', 'Sutter', 'Tehama', 'Trinity', 'Tulare',
  'Tuolumne', 'Ventura', 'Yolo', 'Yuba'
];

function FarmModal({ farm, onClose, onSave }) {
  const isEditing = !!farm?.id;
  
  const [formData, setFormData] = useState({
    name: '',
    farm_number: '',
    owner_name: '',
    operator_name: '',
    address: '',
    county: 'Ventura',
    phone: '',
    email: ''
  });
  
  const [parcels, setParcels] = useState([]);
  const [activeTab, setActiveTab] = useState('basic');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (farm) {
      setFormData({
        name: farm.name || '',
        farm_number: farm.farm_number || '',
        owner_name: farm.owner_name || '',
        operator_name: farm.operator_name || '',
        address: farm.address || '',
        county: farm.county || 'Ventura',
        phone: farm.phone || '',
        email: farm.email || ''
      });
      setParcels(farm.parcels || []);
    }
  }, [farm]);

  const handleSubmit = async () => {
    if (!formData.name || !formData.county) {
      setError('Please fill in Farm Name and County');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let savedFarm;
      
      if (isEditing) {
        // Update existing farm
        const response = await api.put(`/farms/${farm.id}/`, formData);
        savedFarm = response.data;
      } else {
        // Create new farm
        const response = await api.post('/farms/', formData);
        savedFarm = response.data;
      }

      // Save any new parcels (those with temp IDs)
      const newParcels = parcels.filter(p => String(p.id).startsWith('temp-'));
      if (newParcels.length > 0) {
        await api.post(`/farms/${savedFarm.id}/bulk-parcels/`, {
          parcels: newParcels.map(p => ({
            apn: p.apn,
            acreage: p.acreage,
            ownership_type: p.ownership_type,
            notes: p.notes
          })),
          replace: false
        });
      }

      onSave(savedFarm);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save farm');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: Building2 },
    { id: 'parcels', label: `Parcels${parcels.length ? ` (${parcels.length})` : ''}`, icon: MapPin },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex justify-between items-center flex-shrink-0">
          <h2 className="text-2xl font-bold">{farm ? 'Edit Farm' : 'Add Farm'}</h2>
          <button onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-6 flex-shrink-0">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-green-600 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Error */}
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <>
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
                <select
                  value={formData.county}
                  onChange={(e) => setFormData({...formData, county: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                >
                  {CA_COUNTIES.map(county => (
                    <option key={county} value={county}>{county}</option>
                  ))}
                </select>
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
            </>
          )}

          {/* Parcels Tab */}
          {activeTab === 'parcels' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Add all Assessor Parcel Numbers (APNs) associated with this farm. 
                This helps with property tax tracking and regulatory reporting.
              </p>
              
              <FarmParcelManager
                farmId={farm?.id}
                county={formData.county}
                parcels={parcels}
                onChange={setParcels}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex gap-3 justify-end bg-slate-50 flex-shrink-0">
          <button 
            onClick={onClose}
            className="px-6 py-2 border rounded-lg"
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default FarmModal;
