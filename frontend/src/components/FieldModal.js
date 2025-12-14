import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

// California counties for dropdown - prevents typos!
const CALIFORNIA_COUNTIES = [
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

function FieldModal({ field, farms, preselectedFarmId, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    field_number: '',
    farm: '',
    total_acres: '',
    current_crop: '',
    county: '',
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
        name: field.name || '',
        field_number: field.field_number || '',
        farm: field.farm ? String(field.farm) : '',
        total_acres: field.total_acres ? String(field.total_acres) : '',
        current_crop: field.current_crop || '',
        county: field.county || '',
        section: field.section || '',
        township: field.township || '',
        range_value: field.range_value || '',
        planting_date: field.planting_date || '',
        gps_lat: field.gps_lat || '',
        gps_long: field.gps_long || ''
      });
    } else if (preselectedFarmId && farms) {
      const selectedFarm = farms.find(f => f.id === preselectedFarmId || f.id === parseInt(preselectedFarmId));
      setFormData(prev => ({
        ...prev,
        farm: String(preselectedFarmId),
        county: selectedFarm?.county || ''
      }));
    }
  }, [field, preselectedFarmId, farms]);

  const handleFarmChange = (e) => {
    const farmId = e.target.value;
    const selectedFarm = farms?.find(f => f.id === parseInt(farmId));
    setFormData(prev => ({
      ...prev,
      farm: farmId,
      county: (!field && !prev.county && selectedFarm?.county) ? selectedFarm.county : prev.county
    }));
  };

  const handleSubmit = () => {
    if (!formData.name) { alert('Please enter a field name'); return; }
    if (!formData.farm) { alert('Please select a farm - required for PUR compliance'); return; }
    if (!formData.total_acres) { alert('Please enter the total acres'); return; }
    if (!formData.current_crop) { alert('Please select a crop'); return; }
    if (!formData.county) { alert('Please select a county - required for PUR compliance'); return; }

    const dataToSend = {
      name: formData.name,
      field_number: formData.field_number || '',
      farm: parseInt(formData.farm),
      total_acres: parseFloat(formData.total_acres),
      current_crop: formData.current_crop,
      county: formData.county,
      section: formData.section || '',
      township: formData.township || '',
      range_value: formData.range_value || '',
      planting_date: formData.planting_date || null,
      gps_lat: formData.gps_lat ? parseFloat(formData.gps_lat) : null,
      gps_long: formData.gps_long ? parseFloat(formData.gps_long) : null,
      active: true
    };
    console.log('Saving field data:', dataToSend);
    onSave(dataToSend);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-2xl font-bold">{field ? 'Edit Field' : 'Add Field'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={24} /></button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Field Name *</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="e.g., North Block A" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Field Number</label>
              <input type="text" value={formData.field_number} onChange={(e) => setFormData({...formData, field_number: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="e.g., F-001" />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-blue-900 mb-1">Farm * <span className="text-xs font-normal">(Required for PUR)</span></label>
            <select value={formData.farm} onChange={handleFarmChange} className="w-full p-2 border border-blue-300 rounded-lg">
              <option value="">Select farm...</option>
              {farms && farms.map(farm => (<option key={farm.id} value={farm.id}>{farm.name} ({farm.county})</option>))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Acres *</label>
              <input type="number" step="0.01" value={formData.total_acres} onChange={(e) => setFormData({...formData, total_acres: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="e.g., 25.5" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Crop *</label>
              <select value={formData.current_crop} onChange={(e) => setFormData({...formData, current_crop: e.target.value})} className="w-full p-2 border rounded-lg">
                <option value="">Select...</option>
                <option value="Oranges">Oranges</option>
                <option value="Lemons">Lemons</option>
                <option value="Grapefruit">Grapefruit</option>
                <option value="Tangerines">Tangerines</option>
                <option value="Limes">Limes</option>
                <option value="Other Citrus">Other Citrus</option>
                <option value="Almonds">Almonds</option>
                <option value="Walnuts">Walnuts</option>
                <option value="Pistachios">Pistachios</option>
                <option value="Grapes">Grapes</option>
                <option value="Avocados">Avocados</option>
                <option value="Tomatoes">Tomatoes</option>
                <option value="Strawberries">Strawberries</option>
                <option value="Lettuce">Lettuce</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">County * <span className="text-xs font-normal text-gray-500">(Required for PUR)</span></label>
            <select value={formData.county} onChange={(e) => setFormData({...formData, county: e.target.value})} className="w-full p-2 border rounded-lg">
              <option value="">Select county...</option>
              {CALIFORNIA_COUNTIES.map(county => (<option key={county} value={county}>{county}</option>))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Section</label>
              <input type="text" value={formData.section} onChange={(e) => setFormData({...formData, section: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="e.g., 12" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Township</label>
              <input type="text" value={formData.township} onChange={(e) => setFormData({...formData, township: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="e.g., 15S" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Range</label>
              <input type="text" value={formData.range_value} onChange={(e) => setFormData({...formData, range_value: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="e.g., 18E" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Planting Date</label>
            <input type="date" value={formData.planting_date} onChange={(e) => setFormData({...formData, planting_date: e.target.value})} className="w-full p-2 border rounded-lg" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">GPS Latitude</label>
              <input type="text" value={formData.gps_lat} onChange={(e) => setFormData({...formData, gps_lat: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="e.g., 36.7378" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">GPS Longitude</label>
              <input type="text" value={formData.gps_long} onChange={(e) => setFormData({...formData, gps_long: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="e.g., -119.7871" />
            </div>
          </div>
        </div>

        <div className="p-6 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="px-6 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">{field ? 'Update Field' : 'Create Field'}</button>
        </div>
      </div>
    </div>
  );
}

export default FieldModal;