import React, { useState, useEffect } from 'react';
import { Droplets, Save, MapPin, Gauge, Building2, AlertCircle } from 'lucide-react';
import api from '../services/api';
import Modal from './ui/Modal';
import FormField, { inputClasses, selectClasses, textareaClasses } from './ui/FormField';

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
    notes: '',
  });

  const [errors, setErrors] = useState({});
  const [loading, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

  const wellSources = (waterSources || []).filter((ws) => ws.source_type === 'well');

  useEffect(() => {
    if (well) {
      setFormData((prev) => ({ ...prev, ...well }));
    } else {
      setFormData((prev) => ({
        ...prev,
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
        notes: '',
      }));
    }
    setErrors({});
    setActiveTab('basic');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [well, isOpen]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
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
      const cleanData = {
        ...formData,
        source_type: 'well',
        plss_section: formData.section || formData.plss_section || '',
        plss_township: formData.township || formData.plss_township || '',
        plss_range: formData.range_value || formData.plss_range || '',
      };
      Object.keys(cleanData).forEach((key) => {
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

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: Droplets },
    { id: 'location', label: 'Location', icon: MapPin },
    { id: 'pump', label: 'Pump & Meter', icon: Gauge },
    { id: 'compliance', label: 'Compliance', icon: Building2 },
  ];

  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 rounded-button border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        Cancel
      </button>
      <button
        type="submit"
        form="well-form"
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 rounded-button bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        <Save className="w-5 h-5" />
        {loading ? 'Saving…' : well ? 'Update Well' : 'Create Well'}
      </button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={well ? 'Edit Well' : 'Add New Well'}
      subtitle="SGMA groundwater well details"
      icon={Droplets}
      size="xl"
      footer={footer}
    >
      <div className="flex border-b border-gray-200 dark:border-gray-700 -mx-6 -mt-4 mb-4 px-6" role="tablist">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset ${
                isActive
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <form id="well-form" onSubmit={handleSubmit}>
        {errors.general && (
          <div
            className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-300"
            role="alert"
          >
            <AlertCircle className="w-5 h-5" />
            {errors.general}
          </div>
        )}

        {activeTab === 'basic' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Water Source" htmlFor="w-src" required error={errors.water_source}>
                <select
                  id="w-src"
                  name="water_source"
                  value={formData.water_source}
                  onChange={handleChange}
                  className={selectClasses}
                >
                  <option value="">Select water source…</option>
                  {wellSources.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.farm_name} - {ws.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Well Name" htmlFor="w-name">
                <input
                  id="w-name"
                  type="text"
                  name="well_name"
                  value={formData.well_name}
                  onChange={handleChange}
                  placeholder="e.g., North Well"
                  className={inputClasses}
                />
              </FormField>

              <FormField label="GSA" htmlFor="w-gsa">
                <select
                  id="w-gsa"
                  name="gsa"
                  value={formData.gsa}
                  onChange={handleChange}
                  className={selectClasses}
                >
                  <option value="obgma">Ojai Basin GMA (OBGMA)</option>
                  <option value="fpbgsa">Fillmore & Piru Basins GSA</option>
                  <option value="uvrga">Upper Ventura River GA</option>
                  <option value="fcgma">Fox Canyon GMA</option>
                  <option value="none">Not in GSA Jurisdiction</option>
                </select>
              </FormField>

              <FormField label="Basin" htmlFor="w-basin">
                <select
                  id="w-basin"
                  name="basin"
                  value={formData.basin}
                  onChange={handleChange}
                  className={selectClasses}
                >
                  <option value="ojai_valley">Ojai Valley (4-002)</option>
                  <option value="fillmore">Fillmore (4-004.05)</option>
                  <option value="piru">Piru (4-004.06)</option>
                  <option value="santa_paula">Santa Paula (4-004.04)</option>
                  <option value="upper_ventura_river">Upper Ventura River</option>
                  <option value="other">Other</option>
                </select>
              </FormField>

              <FormField label="GSA Well ID" htmlFor="w-gsaid">
                <input
                  id="w-gsaid"
                  type="text"
                  name="gsa_well_id"
                  value={formData.gsa_well_id || ''}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </FormField>

              <FormField label="Status" htmlFor="w-status">
                <select
                  id="w-status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className={selectClasses}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="standby">Standby</option>
                  <option value="monitoring">Monitoring Only</option>
                </select>
              </FormField>
            </div>

            <FormField label="Notes" htmlFor="w-notes">
              <textarea
                id="w-notes"
                name="notes"
                value={formData.notes || ''}
                onChange={handleChange}
                rows={3}
                className={textareaClasses}
              />
            </FormField>
          </div>
        )}

        {activeTab === 'location' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Latitude" htmlFor="w-lat">
                <input
                  id="w-lat"
                  type="number"
                  name="gps_latitude"
                  value={formData.gps_latitude || ''}
                  onChange={handleChange}
                  step="0.0000001"
                  placeholder="34.4472"
                  className={inputClasses}
                />
              </FormField>
              <FormField label="Longitude" htmlFor="w-lng">
                <input
                  id="w-lng"
                  type="number"
                  name="gps_longitude"
                  value={formData.gps_longitude || ''}
                  onChange={handleChange}
                  step="0.0000001"
                  placeholder="-119.2429"
                  className={inputClasses}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField label="Township" htmlFor="w-twp">
                <input
                  id="w-twp"
                  type="text"
                  name="township"
                  value={formData.township || ''}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </FormField>
              <FormField label="Range" htmlFor="w-rng">
                <input
                  id="w-rng"
                  type="text"
                  name="range_value"
                  value={formData.range_value || ''}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </FormField>
              <FormField label="Section" htmlFor="w-sec">
                <input
                  id="w-sec"
                  type="text"
                  name="section"
                  value={formData.section || ''}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </FormField>
              <FormField label="Parcel APN" htmlFor="w-apn">
                <input
                  id="w-apn"
                  type="text"
                  name="parcel_apn"
                  value={formData.parcel_apn || ''}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </FormField>
            </div>
          </div>
        )}

        {activeTab === 'pump' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="Pump Type" htmlFor="w-pumptype">
                <select
                  id="w-pumptype"
                  name="pump_type"
                  value={formData.pump_type || ''}
                  onChange={handleChange}
                  className={selectClasses}
                >
                  <option value="">Select…</option>
                  <option value="submersible">Submersible</option>
                  <option value="turbine">Vertical Turbine</option>
                  <option value="jet">Jet Pump</option>
                </select>
              </FormField>
              <FormField label="Horsepower" htmlFor="w-hp">
                <input
                  id="w-hp"
                  type="number"
                  name="pump_horsepower"
                  value={formData.pump_horsepower || ''}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </FormField>
              <FormField label="Flow Rate (GPM)" htmlFor="w-gpm">
                <input
                  id="w-gpm"
                  type="number"
                  name="pump_flow_rate_gpm"
                  value={formData.pump_flow_rate_gpm || ''}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </FormField>
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="has_flowmeter"
                checked={formData.has_flowmeter}
                onChange={handleChange}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Has Flowmeter
              </span>
            </label>

            {formData.has_flowmeter && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField label="Make" htmlFor="w-fmake">
                  <input
                    id="w-fmake"
                    type="text"
                    name="flowmeter_make"
                    value={formData.flowmeter_make || ''}
                    onChange={handleChange}
                    className={inputClasses}
                  />
                </FormField>
                <FormField label="Serial Number" htmlFor="w-fserial">
                  <input
                    id="w-fserial"
                    type="text"
                    name="flowmeter_serial_number"
                    value={formData.flowmeter_serial_number || ''}
                    onChange={handleChange}
                    className={inputClasses}
                  />
                </FormField>
                <FormField label="Units" htmlFor="w-funits">
                  <select
                    id="w-funits"
                    name="flowmeter_units"
                    value={formData.flowmeter_units}
                    onChange={handleChange}
                    className={selectClasses}
                  >
                    <option value="acre_feet">Acre-Feet</option>
                    <option value="gallons">Gallons</option>
                    <option value="thousand_gallons">Thousand Gallons</option>
                    <option value="hundred_cubic_feet">CCF</option>
                  </select>
                </FormField>
                <FormField label="Multiplier" htmlFor="w-fmult">
                  <input
                    id="w-fmult"
                    type="number"
                    name="flowmeter_multiplier"
                    value={formData.flowmeter_multiplier}
                    onChange={handleChange}
                    step="0.0001"
                    className={inputClasses}
                  />
                </FormField>
              </div>
            )}
          </div>
        )}

        {activeTab === 'compliance' && (
          <div className="space-y-6">
            <div className="space-y-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="registered_with_gsa"
                  checked={formData.registered_with_gsa}
                  onChange={handleChange}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-200">Registered with GSA</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="is_de_minimis"
                  checked={formData.is_de_minimis}
                  onChange={handleChange}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-200">
                  De Minimis Extractor (&lt;2 AF/year domestic)
                </span>
              </label>

              <FormField label="Basin Priority" htmlFor="w-priority">
                <select
                  id="w-priority"
                  name="basin_priority"
                  value={formData.basin_priority}
                  onChange={handleChange}
                  className={selectClasses}
                >
                  <option value="critical">Critically Overdrafted</option>
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>
              </FormField>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
                SGMA Compliance Notes
              </h4>
              <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                <li>• All non-de minimis wells require meter calibration every 3 years</li>
                <li>• Semi-annual extraction reports due April 1 and October 1</li>
                <li>• Meter accuracy must be within ±5%</li>
              </ul>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
};

export default WellModal;
