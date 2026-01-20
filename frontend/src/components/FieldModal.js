import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { FIELD_CONSTANTS } from '../services/api';

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

function FieldModal({ field, farms, crops = [], rootstocks = [], preselectedFarmId, onClose, onSave }) {
  const [activeTab, setActiveTab] = useState('basic');
  const [formData, setFormData] = useState({
    // Basic info
    name: '',
    field_number: '',
    farm: '',
    total_acres: '',
    county: '',
    // Crop info
    crop: '',
    rootstock: '',
    current_crop: '', // Legacy field
    planting_date: '',
    year_planted: '',
    // Spacing & density
    row_spacing_ft: '',
    tree_spacing_ft: '',
    tree_count: '',
    trees_per_acre: '',
    row_orientation: '',
    trellis_system: 'none',
    // Soil & irrigation
    soil_type: '',
    irrigation_type: '',
    // Production
    expected_yield_per_acre: '',
    yield_unit: 'bins',
    // Certification
    organic_status: 'conventional',
    organic_certifier: '',
    organic_cert_number: '',
    organic_cert_expiration: '',
    // Location
    plss_section: '',
    plss_township: '',
    plss_range: '',
    gps_latitude: '',
    gps_longitude: '',
    // Notes
    notes: ''
  });

  // Filter rootstocks based on selected crop
  const filteredRootstocks = formData.crop
    ? rootstocks.filter(rs => {
        // If rootstock has compatible_crop_ids, check if selected crop is in that list
        if (rs.compatible_crop_ids && rs.compatible_crop_ids.length > 0) {
          return rs.compatible_crop_ids.includes(parseInt(formData.crop));
        }
        // Otherwise show all rootstocks that match the crop's category
        const selectedCrop = crops.find(c => c.id === parseInt(formData.crop));
        return selectedCrop && rs.primary_category === selectedCrop.category;
      })
    : rootstocks;

  useEffect(() => {
    if (field) {
      setFormData({
        name: field.name || '',
        field_number: field.field_number || '',
        farm: field.farm ? String(field.farm) : '',
        total_acres: field.total_acres ? String(field.total_acres) : '',
        county: field.county || '',
        // Crop info
        crop: field.crop ? String(field.crop) : '',
        rootstock: field.rootstock ? String(field.rootstock) : '',
        current_crop: field.current_crop || '',
        planting_date: field.planting_date || '',
        year_planted: field.year_planted ? String(field.year_planted) : '',
        // Spacing & density
        row_spacing_ft: field.row_spacing_ft ? String(field.row_spacing_ft) : '',
        tree_spacing_ft: field.tree_spacing_ft ? String(field.tree_spacing_ft) : '',
        tree_count: field.tree_count ? String(field.tree_count) : '',
        trees_per_acre: field.trees_per_acre ? String(field.trees_per_acre) : '',
        row_orientation: field.row_orientation || '',
        trellis_system: field.trellis_system || 'none',
        // Soil & irrigation
        soil_type: field.soil_type || '',
        irrigation_type: field.irrigation_type || '',
        // Production
        expected_yield_per_acre: field.expected_yield_per_acre ? String(field.expected_yield_per_acre) : '',
        yield_unit: field.yield_unit || 'bins',
        // Certification
        organic_status: field.organic_status || 'conventional',
        organic_certifier: field.organic_certifier || '',
        organic_cert_number: field.organic_cert_number || '',
        organic_cert_expiration: field.organic_cert_expiration || '',
        // Location
        plss_section: field.plss_section || '',
        plss_township: field.plss_township || '',
        plss_range: field.plss_range || '',
        gps_latitude: field.gps_latitude || '',
        gps_longitude: field.gps_longitude || '',
        // Notes
        notes: field.notes || ''
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

  const handleCropChange = (e) => {
    const cropId = e.target.value;
    const selectedCrop = crops.find(c => c.id === parseInt(cropId));
    setFormData(prev => ({
      ...prev,
      crop: cropId,
      // Update legacy current_crop field for backward compatibility
      current_crop: selectedCrop ? selectedCrop.name : prev.current_crop,
      // Clear rootstock if no longer compatible
      rootstock: ''
    }));
  };

  const handleSubmit = () => {
    if (!formData.name) { alert('Please enter a field name'); return; }
    if (!formData.farm) { alert('Please select a farm - required for PUR compliance'); return; }
    if (!formData.total_acres) { alert('Please enter the total acres'); return; }
    if (!formData.crop && !formData.current_crop) { alert('Please select a crop'); return; }
    if (!formData.county) { alert('Please select a county - required for PUR compliance'); return; }

    const dataToSend = {
      // Basic info
      name: formData.name,
      field_number: formData.field_number || '',
      farm: parseInt(formData.farm),
      total_acres: parseFloat(formData.total_acres),
      county: formData.county,
      // Crop info
      crop: formData.crop ? parseInt(formData.crop) : null,
      rootstock: formData.rootstock ? parseInt(formData.rootstock) : null,
      current_crop: formData.current_crop || '',
      planting_date: formData.planting_date || null,
      year_planted: formData.year_planted ? parseInt(formData.year_planted) : null,
      // Spacing & density
      row_spacing_ft: formData.row_spacing_ft ? parseFloat(formData.row_spacing_ft) : null,
      tree_spacing_ft: formData.tree_spacing_ft ? parseFloat(formData.tree_spacing_ft) : null,
      tree_count: formData.tree_count ? parseInt(formData.tree_count) : null,
      trees_per_acre: formData.trees_per_acre ? parseFloat(formData.trees_per_acre) : null,
      row_orientation: formData.row_orientation || '',
      trellis_system: formData.trellis_system || 'none',
      // Soil & irrigation
      soil_type: formData.soil_type || '',
      irrigation_type: formData.irrigation_type || '',
      // Production
      expected_yield_per_acre: formData.expected_yield_per_acre ? parseFloat(formData.expected_yield_per_acre) : null,
      yield_unit: formData.yield_unit || 'bins',
      // Certification
      organic_status: formData.organic_status || 'conventional',
      organic_certifier: formData.organic_certifier || '',
      organic_cert_number: formData.organic_cert_number || '',
      organic_cert_expiration: formData.organic_cert_expiration || null,
      // Location
      plss_section: formData.plss_section || '',
      plss_township: formData.plss_township || '',
      plss_range: formData.plss_range || '',
      gps_latitude: formData.gps_latitude ? parseFloat(formData.gps_latitude) : null,
      gps_longitude: formData.gps_longitude ? parseFloat(formData.gps_longitude) : null,
      // Notes
      notes: formData.notes || '',
      active: true
    };
    console.log('Saving field data:', dataToSend);
    onSave(dataToSend);
  };

  const tabs = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'crop', label: 'Crop & Planting' },
    { id: 'spacing', label: 'Spacing & Density' },
    { id: 'soil', label: 'Soil & Irrigation' },
    { id: 'location', label: 'Location' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-2xl font-bold">{field ? 'Edit Field' : 'Add Field'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={24} /></button>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <div className="flex overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-green-600 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <>
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
                  <label className="block text-sm font-medium mb-1">County * <span className="text-xs font-normal text-gray-500">(Required for PUR)</span></label>
                  <select value={formData.county} onChange={(e) => setFormData({...formData, county: e.target.value})} className="w-full p-2 border rounded-lg">
                    <option value="">Select county...</option>
                    {CALIFORNIA_COUNTIES.map(county => (<option key={county} value={county}>{county}</option>))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                  rows={3}
                  placeholder="Optional notes about this field..."
                />
              </div>
            </>
          )}

          {/* Crop & Planting Tab */}
          {activeTab === 'crop' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Crop *</label>
                  <select
                    value={formData.crop}
                    onChange={handleCropChange}
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="">Select crop...</option>
                    {crops.map(crop => (
                      <option key={crop.id} value={crop.id}>
                        {crop.display_name || crop.name}
                      </option>
                    ))}
                  </select>
                  {crops.length === 0 && (
                    <p className="text-xs text-gray-500 mt-1">No crops available. Add crops in settings.</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Rootstock</label>
                  <select
                    value={formData.rootstock}
                    onChange={(e) => setFormData({...formData, rootstock: e.target.value})}
                    className="w-full p-2 border rounded-lg"
                    disabled={!formData.crop}
                  >
                    <option value="">Select rootstock...</option>
                    {filteredRootstocks.map(rs => (
                      <option key={rs.id} value={rs.id}>
                        {rs.display_name || rs.name}
                      </option>
                    ))}
                  </select>
                  {!formData.crop && (
                    <p className="text-xs text-gray-500 mt-1">Select a crop first to see compatible rootstocks.</p>
                  )}
                </div>
              </div>

              {/* Fallback for legacy crop if no structured crops exist */}
              {crops.length === 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1">Crop (Text) *</label>
                  <input
                    type="text"
                    value={formData.current_crop}
                    onChange={(e) => setFormData({...formData, current_crop: e.target.value})}
                    className="w-full p-2 border rounded-lg"
                    placeholder="e.g., Navel Orange"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Planting Date</label>
                  <input type="date" value={formData.planting_date} onChange={(e) => setFormData({...formData, planting_date: e.target.value})} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Year Planted</label>
                  <input
                    type="number"
                    value={formData.year_planted}
                    onChange={(e) => setFormData({...formData, year_planted: e.target.value})}
                    className="w-full p-2 border rounded-lg"
                    placeholder="e.g., 2015"
                    min="1900"
                    max={new Date().getFullYear()}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Organic Status</label>
                  <select
                    value={formData.organic_status}
                    onChange={(e) => setFormData({...formData, organic_status: e.target.value})}
                    className="w-full p-2 border rounded-lg"
                  >
                    {FIELD_CONSTANTS.ORGANIC_STATUSES.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                {formData.organic_status === 'certified' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Certifier</label>
                    <input
                      type="text"
                      value={formData.organic_certifier}
                      onChange={(e) => setFormData({...formData, organic_certifier: e.target.value})}
                      className="w-full p-2 border rounded-lg"
                      placeholder="e.g., CCOF"
                    />
                  </div>
                )}
              </div>

              {formData.organic_status === 'certified' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Certificate Number</label>
                    <input
                      type="text"
                      value={formData.organic_cert_number}
                      onChange={(e) => setFormData({...formData, organic_cert_number: e.target.value})}
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Certificate Expiration</label>
                    <input
                      type="date"
                      value={formData.organic_cert_expiration}
                      onChange={(e) => setFormData({...formData, organic_cert_expiration: e.target.value})}
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Spacing & Density Tab */}
          {activeTab === 'spacing' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Row Spacing (ft)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.row_spacing_ft}
                    onChange={(e) => setFormData({...formData, row_spacing_ft: e.target.value})}
                    className="w-full p-2 border rounded-lg"
                    placeholder="e.g., 22"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Tree/Plant Spacing (ft)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.tree_spacing_ft}
                    onChange={(e) => setFormData({...formData, tree_spacing_ft: e.target.value})}
                    className="w-full p-2 border rounded-lg"
                    placeholder="e.g., 18"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tree/Plant Count</label>
                  <input
                    type="number"
                    value={formData.tree_count}
                    onChange={(e) => setFormData({...formData, tree_count: e.target.value})}
                    className="w-full p-2 border rounded-lg"
                    placeholder="e.g., 2500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Trees per Acre</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.trees_per_acre}
                    onChange={(e) => setFormData({...formData, trees_per_acre: e.target.value})}
                    className="w-full p-2 border rounded-lg"
                    placeholder="Auto-calculated if spacing provided"
                  />
                  {formData.row_spacing_ft && formData.tree_spacing_ft && (
                    <p className="text-xs text-gray-500 mt-1">
                      Calculated: {(43560 / (parseFloat(formData.row_spacing_ft) * parseFloat(formData.tree_spacing_ft))).toFixed(1)} trees/acre
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Row Orientation</label>
                  <select
                    value={formData.row_orientation}
                    onChange={(e) => setFormData({...formData, row_orientation: e.target.value})}
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="">Select...</option>
                    {FIELD_CONSTANTS.ROW_ORIENTATIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Trellis System</label>
                  <select
                    value={formData.trellis_system}
                    onChange={(e) => setFormData({...formData, trellis_system: e.target.value})}
                    className="w-full p-2 border rounded-lg"
                  >
                    {FIELD_CONSTANTS.TRELLIS_SYSTEMS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Expected Yield per Acre</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.expected_yield_per_acre}
                    onChange={(e) => setFormData({...formData, expected_yield_per_acre: e.target.value})}
                    className="w-full p-2 border rounded-lg"
                    placeholder="e.g., 15"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Yield Unit</label>
                  <select
                    value={formData.yield_unit}
                    onChange={(e) => setFormData({...formData, yield_unit: e.target.value})}
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="bins">Bins</option>
                    <option value="lbs">Pounds</option>
                    <option value="tons">Tons</option>
                    <option value="boxes">Boxes</option>
                    <option value="lugs">Lugs</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Soil & Irrigation Tab */}
          {activeTab === 'soil' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Soil Type</label>
                  <select
                    value={formData.soil_type}
                    onChange={(e) => setFormData({...formData, soil_type: e.target.value})}
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="">Select...</option>
                    {FIELD_CONSTANTS.SOIL_TYPES.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Irrigation Type</label>
                  <select
                    value={formData.irrigation_type}
                    onChange={(e) => setFormData({...formData, irrigation_type: e.target.value})}
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="">Select...</option>
                    {FIELD_CONSTANTS.IRRIGATION_TYPES.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Location Tab */}
          {activeTab === 'location' && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Section</label>
                  <input type="text" value={formData.plss_section} onChange={(e) => setFormData({...formData, plss_section: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="e.g., 12" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Township</label>
                  <input type="text" value={formData.plss_township} onChange={(e) => setFormData({...formData, plss_township: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="e.g., 15S" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Range</label>
                  <input type="text" value={formData.plss_range} onChange={(e) => setFormData({...formData, plss_range: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="e.g., 18E" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">GPS Latitude</label>
                  <input type="text" value={formData.gps_latitude} onChange={(e) => setFormData({...formData, gps_latitude: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="e.g., 36.7378" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">GPS Longitude</label>
                  <input type="text" value={formData.gps_longitude} onChange={(e) => setFormData({...formData, gps_longitude: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="e.g., -119.7871" />
                </div>
              </div>
            </>
          )}
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
