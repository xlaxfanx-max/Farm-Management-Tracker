// =============================================================================
// WELL MODAL COMPONENT
// =============================================================================
// src/components/WellModal.js
// Modal for creating and editing well records
// =============================================================================

import React, { useState, useEffect } from 'react';
import { X, Droplets, Save, MapPin, Gauge, Building2, AlertCircle } from 'lucide-react';
import api from '../services/api';

const WellModal = ({ isOpen, onClose, well, waterSources, onSave }) => {
  const [formData, setFormData] = useState({
    water_source: '',
    well_name: '',
    state_well_number: '',
    local_well_id: '',
    gsa_well_id: '',
    gsa: 'obgma',
    gsa_account_number: '',
    basin: 'ojai_valley',
    basin_priority: 'medium',
    well_depth_ft: '',
    casing_diameter_inches: '',
    gps_latitude: '',
    gps_longitude: '',
    township: '',
    range_value: '',
    section: '',
    parcel_apn: '',
    pump_type: '',
    pump_horsepower: '',
    pump_flow_rate_gpm: '',
    power_source: '',
    utility_meter_number: '',
    has_flowmeter: true,
    flowmeter_make: '',
    flowmeter_model: '',
    flowmeter_serial_number: '',
    flowmeter_units: 'gallons',
    flowmeter_multiplier: '1.0',
    has_ami: false,
    ami_vendor: '',
    ami_device_id: '',
    status: 'active',
    is_de_minimis: false,
    registered_with_gsa: false,
    notes: ''
  });

  const [errors, setErrors] = useState({});
  const [loading, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

  const wellSources = (waterSources || []).filter(ws => ws.source_type === 'well');

  useEffect(() => {
    if (well) {
      setFormData({ ...formData, ...well });
    } else {
      setFormData({
        water_source: wellSources[0]?.id || '',
        well_name: '',
        gsa: 'obgma',
        basin: 'ojai_valley',
        basin_priority: 'medium',
        has_flowmeter: true,
        flowmeter_units: 'gallons',
        flowmeter_multiplier: '1.0',
        has_ami: false,
        status: 'active',
        is_de_minimis: false,
        registered_with_gsa: false,
        notes: ''
      });
    }
    setErrors({});
    setActiveTab('basic');
  }, [well, isOpen]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.water_source) {
      setErrors({ water_source: 'Water source is required' });
      return;
    }
    
    setSaving(true);
    try {
      // Prepare data with source_type for unified WaterSource model
      const cleanData = { 
        ...formData,
        source_type: 'well',
        // Map old field names to new PLSS field names
        plss_section: formData.section || formData.plss_section || '',
        plss_township: formData.township || formData.plss_township || '',
        plss_range: formData.range_value || formData.plss_range || '',
      };
      Object.keys(cleanData).forEach(key => {
        if (cleanData[key] === '') cleanData[key] = null;
      });
      
      if (well?.id) {
        await api.put(`/water-sources/${well.id}/`, cleanData);
      } else {
        await api.post('/water-sources/', cleanData);
      }
      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving well:', err);
      setErrors(err.response?.data || { general: 'Failed to save well' });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: Droplets },
    { id: 'location', label: 'Location', icon: MapPin },
    { id: 'pump', label: 'Pump & Meter', icon: Gauge },
    { id: 'compliance', label: 'Compliance', icon: Building2 }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Droplets className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {well ? 'Edit Well' : 'Add New Well'}
              </h2>
              <p className="text-sm text-gray-500">SGMA groundwater well details</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {errors.general && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5" />
                {errors.general}
              </div>
            )}

            {/* Basic Info Tab */}
            {activeTab === 'basic' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Water Source <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="water_source"
                      value={formData.water_source}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        errors.water_source ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select water source...</option>
                      {wellSources.map(ws => (
                        <option key={ws.id} value={ws.id}>{ws.farm_name} - {ws.name}</option>
                      ))}
                    </select>
                    {errors.water_source && <p className="text-red-500 text-sm mt-1">{errors.water_source}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Well Name</label>
                    <input
                      type="text"
                      name="well_name"
                      value={formData.well_name}
                      onChange={handleChange}
                      placeholder="e.g., North Well"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">GSA</label>
                    <select name="gsa" value={formData.gsa} onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="obgma">Ojai Basin GMA (OBGMA)</option>
                      <option value="fpbgsa">Fillmore & Piru Basins GSA</option>
                      <option value="uvrga">Upper Ventura River GA</option>
                      <option value="fcgma">Fox Canyon GMA</option>
                      <option value="none">Not in GSA Jurisdiction</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Basin</label>
                    <select name="basin" value={formData.basin} onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="ojai_valley">Ojai Valley (4-002)</option>
                      <option value="fillmore">Fillmore (4-004.05)</option>
                      <option value="piru">Piru (4-004.06)</option>
                      <option value="santa_paula">Santa Paula (4-004.04)</option>
                      <option value="upper_ventura_river">Upper Ventura River</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">GSA Well ID</label>
                    <input type="text" name="gsa_well_id" value={formData.gsa_well_id || ''} onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select name="status" value={formData.status} onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="standby">Standby</option>
                      <option value="monitoring">Monitoring Only</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea name="notes" value={formData.notes || ''} onChange={handleChange} rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            )}

            {/* Location Tab */}
            {activeTab === 'location' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                    <input type="number" name="gps_latitude" value={formData.gps_latitude || ''} onChange={handleChange}
                      step="0.0000001" placeholder="34.4472"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                    <input type="number" name="gps_longitude" value={formData.gps_longitude || ''} onChange={handleChange}
                      step="0.0000001" placeholder="-119.2429"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Township</label>
                    <input type="text" name="township" value={formData.township || ''} onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Range</label>
                    <input type="text" name="range_value" value={formData.range_value || ''} onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Section</label>
                    <input type="text" name="section" value={formData.section || ''} onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Parcel APN</label>
                    <input type="text" name="parcel_apn" value={formData.parcel_apn || ''} onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>
            )}

            {/* Pump & Meter Tab */}
            {activeTab === 'pump' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Pump Type</label>
                    <select name="pump_type" value={formData.pump_type || ''} onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="">Select...</option>
                      <option value="submersible">Submersible</option>
                      <option value="turbine">Vertical Turbine</option>
                      <option value="jet">Jet Pump</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Horsepower</label>
                    <input type="number" name="pump_horsepower" value={formData.pump_horsepower || ''} onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Flow Rate (GPM)</label>
                    <input type="number" name="pump_flow_rate_gpm" value={formData.pump_flow_rate_gpm || ''} onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="has_flowmeter" checked={formData.has_flowmeter} onChange={handleChange}
                      className="rounded border-gray-300 text-blue-600" />
                    <span className="text-sm font-medium text-gray-700">Has Flowmeter</span>
                  </label>
                </div>

                {formData.has_flowmeter && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Make</label>
                      <input type="text" name="flowmeter_make" value={formData.flowmeter_make || ''} onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Serial Number</label>
                      <input type="text" name="flowmeter_serial_number" value={formData.flowmeter_serial_number || ''} onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Units</label>
                      <select name="flowmeter_units" value={formData.flowmeter_units} onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                        <option value="acre_feet">Acre-Feet</option>
                        <option value="gallons">Gallons</option>
                        <option value="thousand_gallons">Thousand Gallons</option>
                        <option value="hundred_cubic_feet">CCF</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Multiplier</label>
                      <input type="number" name="flowmeter_multiplier" value={formData.flowmeter_multiplier} onChange={handleChange}
                        step="0.0001"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Compliance Tab */}
            {activeTab === 'compliance' && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="registered_with_gsa" checked={formData.registered_with_gsa} onChange={handleChange}
                      className="rounded border-gray-300 text-blue-600" />
                    <span className="text-sm text-gray-700">Registered with GSA</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="is_de_minimis" checked={formData.is_de_minimis} onChange={handleChange}
                      className="rounded border-gray-300 text-blue-600" />
                    <span className="text-sm text-gray-700">De Minimis Extractor (&lt;2 AF/year domestic)</span>
                  </label>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Basin Priority</label>
                    <select name="basin_priority" value={formData.basin_priority} onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="critical">Critically Overdrafted</option>
                      <option value="high">High Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="low">Low Priority</option>
                    </select>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">SGMA Compliance Notes</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• All non-de minimis wells require meter calibration every 3 years</li>
                    <li>• Semi-annual extraction reports due April 1 and October 1</li>
                    <li>• Meter accuracy must be within ±5%</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
            <button type="button" onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              <Save className="w-5 h-5" />
              {loading ? 'Saving...' : (well ? 'Update Well' : 'Create Well')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WellModal;
