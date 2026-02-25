// =============================================================================
// UNIFIED WELL SOURCE MODAL
// =============================================================================
// src/components/WellSourceModal.js
// Combined modal for creating/editing wells with both basic water source info
// AND SGMA compliance details in one unified interface
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, Droplets, Save, MapPin, Gauge, Building2, AlertCircle,
  Info, CheckCircle, Navigation, Crosshair
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';

// =============================================================================
// CONSTANTS
// =============================================================================

const GSA_OPTIONS = [
  { value: 'obgma', label: 'Ojai Basin GMA' },
  { value: 'uwcd', label: 'United Water Conservation District' },
  { value: 'fpbgsa', label: 'Fillmore & Piru Basins GSA' },
  { value: 'uvrga', label: 'Upper Ventura River GA' },
  { value: 'fcgma', label: 'Fox Canyon GMA' },
  { value: 'other', label: 'Other' },
  { value: 'none', label: 'None / Not in GSA' },
];

const BASIN_OPTIONS = [
  { value: 'ojai_valley', label: 'Ojai Valley Basin' },
  { value: 'upper_ventura_river', label: 'Upper Ventura River Basin' },
  { value: 'fillmore', label: 'Fillmore Basin' },
  { value: 'piru', label: 'Piru Basin' },
  { value: 'santa_paula', label: 'Santa Paula Basin' },
  { value: 'oxnard', label: 'Oxnard Plain Basin' },
  { value: 'pleasant_valley', label: 'Pleasant Valley Basin' },
  { value: 'las_posas', label: 'Las Posas Valley Basin' },
  { value: 'mound', label: 'Mound Basin' },
  { value: 'other', label: 'Other' },
];

const PUMP_TYPE_OPTIONS = [
  { value: '', label: 'Select...' },
  { value: 'submersible', label: 'Submersible' },
  { value: 'turbine', label: 'Vertical Turbine' },
  { value: 'jet', label: 'Jet Pump' },
  { value: 'centrifugal', label: 'Centrifugal' },
  { value: 'other', label: 'Other' },
];

const POWER_SOURCE_OPTIONS = [
  { value: '', label: 'Select...' },
  { value: 'electric', label: 'Electric' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'natural_gas', label: 'Natural Gas' },
  { value: 'solar', label: 'Solar' },
  { value: 'other', label: 'Other' },
];

const FLOWMETER_UNIT_OPTIONS = [
  { value: 'acre_feet', label: 'Acre-Feet' },
  { value: 'gallons', label: 'Gallons' },
  { value: 'hundred_gallons', label: 'Hundred Gallons' },
  { value: 'thousand_gallons', label: 'Thousand Gallons' },
  { value: 'cubic_feet', label: 'Cubic Feet' },
  { value: 'hundred_cubic_feet', label: 'CCF (Hundred Cubic Feet)' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'standby', label: 'Standby' },
  { value: 'destroyed', label: 'Destroyed' },
  { value: 'monitoring', label: 'Monitoring Only' },
];

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const WellSourceModal = ({ isOpen, onClose, wellSource, farms, fields, onSave }) => {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('basic');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [useCustomLocation, setUseCustomLocation] = useState(false);
  const [selectedFarm, setSelectedFarm] = useState(null);
  const [gsaFeeDefaults, setGsaFeeDefaults] = useState({});

  // Form data - combines WaterSource + Well fields
  const [formData, setFormData] = useState({
    // === Water Source Fields ===
    farm: '',
    name: '',
    source_type: 'well', // Always 'well' for this modal
    location_description: '',
    used_for_irrigation: true,
    used_for_washing: false,
    used_for_pesticide_mixing: false,
    fields_served: [],
    test_frequency_days: 365,
    active: true,
    
    // === Well SGMA Fields ===
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
    well_construction_date: '', // Correct field name
    well_permit_number: '',
    
    // Location - defaults from farm, can override
    gps_latitude: '',
    gps_longitude: '',
    township: '',
    range_value: '',
    section: '',
    parcel_apn: '',
    
    // Pump info
    pump_type: '',
    pump_horsepower: '',
    pump_flow_rate_gpm: '',
    power_source: '',
    utility_meter_number: '',
    
    // Flowmeter
    has_flowmeter: true,
    flowmeter_make: '',
    flowmeter_model: '',
    flowmeter_serial_number: '',
    flowmeter_units: 'gallons',
    flowmeter_multiplier: '1.0',
    flowmeter_installation_date: '', // Correct field name
    
    // AMI (Automated Meter Infrastructure)
    has_ami: false,
    ami_vendor: '',
    ami_device_id: '',
    
    // Status & Compliance
    status: 'active',
    is_de_minimis: false,
    registered_with_gsa: false,
    gsa_registration_date: '',

    // GSA Fee Configuration
    base_extraction_rate: '',
    gsp_rate: '',
    domestic_rate: '',
    fixed_quarterly_fee: '',
    is_domestic_well: false,
    owner_code: '',

    notes: ''
  });

  // ---------------------------------------------------------------------------
  // Fetch GSA fee defaults
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const fetchGsaDefaults = async () => {
      try {
        const response = await api.get('/water-sources/gsa_fee_defaults/');
        setGsaFeeDefaults(response.data);
      } catch (err) {
        console.log('Could not load GSA fee defaults:', err);
      }
    };
    if (isOpen) {
      fetchGsaDefaults();
    }
  }, [isOpen]);

  // ---------------------------------------------------------------------------
  // Load existing data or reset
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;
    
    if (wellSource) {
      // Editing existing - load both water source and well data
      const loadExisting = async () => {
        try {
          // Start with water source data
          const newFormData = {
            ...formData,
            farm: wellSource.farm || '',
            name: wellSource.name || '',
            location_description: wellSource.location_description || '',
            used_for_irrigation: wellSource.used_for_irrigation ?? true,
            used_for_washing: wellSource.used_for_washing ?? false,
            used_for_pesticide_mixing: wellSource.used_for_pesticide_mixing ?? false,
            fields_served: wellSource.fields_served || [],
            test_frequency_days: wellSource.test_frequency_days || 365,
            active: wellSource.active ?? true,
            
            // Well-specific fields are now directly on WaterSource
            well_name: wellSource.well_name || wellSource.name || '',
            state_well_number: wellSource.state_well_number || '',
            local_well_id: wellSource.local_well_id || '',
            gsa_well_id: wellSource.gsa_well_id || '',
            gsa: wellSource.gsa || 'obgma',
            gsa_account_number: wellSource.gsa_account_number || '',
            basin: wellSource.basin || 'ojai_valley',
            basin_priority: wellSource.basin_priority || 'medium',
            well_depth_ft: wellSource.well_depth_ft || '',
            casing_diameter_inches: wellSource.casing_diameter_inches || '',
            well_construction_date: wellSource.well_construction_date || '',
            well_permit_number: wellSource.well_permit_number || '',
            gps_latitude: wellSource.gps_latitude || '',
            gps_longitude: wellSource.gps_longitude || '',
            plss_township: wellSource.plss_township || '',
            plss_range: wellSource.plss_range || '',
            plss_section: wellSource.plss_section || '',
            parcel_apn: wellSource.parcel_apn || '',
            pump_type: wellSource.pump_type || '',
            pump_horsepower: wellSource.pump_horsepower || '',
            pump_flow_rate_gpm: wellSource.pump_flow_rate_gpm || '',
            power_source: wellSource.power_source || '',
            utility_meter_number: wellSource.utility_meter_number || '',
            has_flowmeter: wellSource.has_flowmeter ?? true,
            flowmeter_make: wellSource.flowmeter_make || '',
            flowmeter_model: wellSource.flowmeter_model || '',
            flowmeter_serial_number: wellSource.flowmeter_serial_number || '',
            flowmeter_units: wellSource.flowmeter_units || 'acre_feet',
            flowmeter_multiplier: wellSource.flowmeter_multiplier || '1.0',
            flowmeter_installation_date: wellSource.flowmeter_installation_date || '',
            has_ami: wellSource.has_ami ?? false,
            ami_vendor: wellSource.ami_vendor || '',
            ami_device_id: wellSource.ami_device_id || '',
            status: wellSource.well_status || 'active',
            is_de_minimis: wellSource.is_de_minimis ?? false,
            registered_with_gsa: wellSource.registered_with_gsa ?? false,
            gsa_registration_date: wellSource.gsa_registration_date || '',
            // Fee configuration
            base_extraction_rate: wellSource.base_extraction_rate || '',
            gsp_rate: wellSource.gsp_rate || '',
            domestic_rate: wellSource.domestic_rate || '',
            fixed_quarterly_fee: wellSource.fixed_quarterly_fee || '',
            is_domestic_well: wellSource.is_domestic_well ?? false,
            owner_code: wellSource.owner_code || '',
            notes: wellSource.notes || '',
          };

          // Check if location differs from farm
          if (wellSource.gps_latitude || wellSource.gps_longitude) {
            setUseCustomLocation(true);
          }

          setFormData(newFormData);
          
          // Set selected farm
          const farm = farms.find(f => f.id === wellSource.farm);
          setSelectedFarm(farm || null);
          
        } catch (err) {
          console.error('Error loading well data:', err);
        }
      };
      
      loadExisting();
    } else {
      // Creating new - reset form
      setFormData({
        farm: '',
        name: '',
        source_type: 'well',
        location_description: '',
        used_for_irrigation: true,
        used_for_washing: false,
        used_for_pesticide_mixing: false,
        fields_served: [],
        test_frequency_days: 365,
        active: true,
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
        well_construction_date: '',
        well_permit_number: '',
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
        flowmeter_installation_date: '',
        has_ami: false,
        ami_vendor: '',
        ami_device_id: '',
        status: 'active',
        is_de_minimis: false,
        registered_with_gsa: false,
        gsa_registration_date: '',
        // Fee configuration
        base_extraction_rate: '',
        gsp_rate: '',
        domestic_rate: '',
        fixed_quarterly_fee: '',
        is_domestic_well: false,
        owner_code: '',
        notes: ''
      });
      setSelectedFarm(null);
      setUseCustomLocation(false);
    }
    
    setErrors({});
    setActiveTab('basic');
  }, [isOpen, wellSource, farms]);

  // ---------------------------------------------------------------------------
  // Farm selection handler - auto-populate location
  // ---------------------------------------------------------------------------
  const handleFarmChange = (farmId) => {
    const farm = farms.find(f => f.id === parseInt(farmId));
    setSelectedFarm(farm || null);
    setFormData(prev => ({
      ...prev,
      farm: farmId,
      fields_served: [], // Reset fields when farm changes
    }));
    
    // If not using custom location, update location from farm
    if (!useCustomLocation && farm) {
      setFormData(prev => ({
        ...prev,
        farm: farmId,
        // Location derived from farm
        gps_latitude: farm.gps_lat || '',
        gps_longitude: farm.gps_long || '',
        township: farm.township || '',
        range_value: farm.range_value || '',
        section: farm.section || '',
        parcel_apn: farm.parcel_apn || '',
      }));
    }
  };

  // ---------------------------------------------------------------------------
  // Handle custom location toggle
  // ---------------------------------------------------------------------------
  const handleCustomLocationToggle = (useCustom) => {
    setUseCustomLocation(useCustom);
    
    if (!useCustom && selectedFarm) {
      // Revert to farm location
      setFormData(prev => ({
        ...prev,
        gps_latitude: selectedFarm.gps_lat || '',
        gps_longitude: selectedFarm.gps_long || '',
        township: selectedFarm.township || '',
        range_value: selectedFarm.range_value || '',
        section: selectedFarm.section || '',
        parcel_apn: selectedFarm.parcel_apn || '',
      }));
    }
  };

  // ---------------------------------------------------------------------------
  // Get current location
  // ---------------------------------------------------------------------------
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          gps_latitude: position.coords.latitude.toFixed(7),
          gps_longitude: position.coords.longitude.toFixed(7),
        }));
        setUseCustomLocation(true);
        
        // Auto-lookup PLSS from coordinates
        lookupPLSS(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        toast.error('Unable to get your location: ' + error.message);
      }
    );
  };

  // ---------------------------------------------------------------------------
  // PLSS Lookup from coordinates
  // ---------------------------------------------------------------------------
  const lookupPLSS = async (lat, lng) => {
    try {
      const response = await api.post('/plss/', { lat, lng });
      if (response.data) {
        setFormData(prev => ({
          ...prev,
          township: response.data.township || prev.township,
          range_value: response.data.range || prev.range_value,
          section: response.data.section || prev.section,
        }));
      }
    } catch (err) {
      console.log('PLSS lookup failed:', err);
    }
  };

  // ---------------------------------------------------------------------------
  // Form change handler
  // ---------------------------------------------------------------------------
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // ---------------------------------------------------------------------------
  // Apply GSA fee defaults
  // ---------------------------------------------------------------------------
  const applyGsaFeeDefaults = () => {
    const gsa = formData.gsa;
    const defaults = gsaFeeDefaults[gsa];
    if (defaults) {
      setFormData(prev => ({
        ...prev,
        base_extraction_rate: defaults.base_extraction_rate || '',
        gsp_rate: defaults.gsp_rate || '',
        domestic_rate: defaults.domestic_rate || '',
        fixed_quarterly_fee: defaults.fixed_quarterly_fee || '',
      }));
    }
  };

  // ---------------------------------------------------------------------------
  // Validate form
  // ---------------------------------------------------------------------------
  const validate = () => {
    const newErrors = {};
    
    if (!formData.farm) {
      newErrors.farm = 'Farm is required';
    }
    if (!formData.name.trim()) {
      newErrors.name = 'Well name is required';
    }
    if (!formData.gsa) {
      newErrors.gsa = 'GSA selection is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ---------------------------------------------------------------------------
  // Submit handler - saves unified WaterSource (includes well data)
  // ---------------------------------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) {
      // Switch to tab with first error
      if (errors.farm || errors.name) setActiveTab('basic');
      return;
    }
    
    setLoading(true);
    try {
      // Prepare unified water source data (includes all well fields)
      const waterSourceData = {
        // Basic water source fields
        farm: parseInt(formData.farm),
        name: formData.name,
        source_type: 'well',
        location_description: formData.location_description || '',
        used_for_irrigation: formData.used_for_irrigation,
        used_for_washing: formData.used_for_washing,
        used_for_pesticide_mixing: formData.used_for_pesticide_mixing,
        test_frequency_days: parseInt(formData.test_frequency_days) || 365,
        active: formData.active,
        
        // Well identification fields
        well_name: formData.well_name || formData.name,
        state_well_number: formData.state_well_number || '',
        local_well_id: formData.local_well_id || '',
        gsa_well_id: formData.gsa_well_id || '',
        
        // GSA/Basin fields
        gsa: formData.gsa || 'obgma',
        gsa_account_number: formData.gsa_account_number || '',
        basin: formData.basin || 'ojai_valley',
        basin_priority: formData.basin_priority || 'medium',
        
        // Physical characteristics
        well_depth_ft: formData.well_depth_ft ? parseFloat(formData.well_depth_ft) : null,
        casing_diameter_inches: formData.casing_diameter_inches ? parseFloat(formData.casing_diameter_inches) : null,
        
        // Location (from LocationMixin)
        gps_latitude: formData.gps_latitude ? parseFloat(formData.gps_latitude) : null,
        gps_longitude: formData.gps_longitude ? parseFloat(formData.gps_longitude) : null,
        plss_township: formData.township || formData.plss_township || '',
        plss_range: formData.range_value || formData.plss_range || '',
        plss_section: formData.section || formData.plss_section || '',
        parcel_apn: formData.parcel_apn || '',
        
        // Pump info
        pump_type: formData.pump_type || '',
        pump_horsepower: formData.pump_horsepower ? parseFloat(formData.pump_horsepower) : null,
        pump_flow_rate_gpm: formData.pump_flow_rate_gpm ? parseFloat(formData.pump_flow_rate_gpm) : null,
        power_source: formData.power_source || '',
        utility_meter_number: formData.utility_meter_number || '',
        
        // Flowmeter
        has_flowmeter: formData.has_flowmeter ?? true,
        flowmeter_make: formData.flowmeter_make || '',
        flowmeter_model: formData.flowmeter_model || '',
        flowmeter_serial_number: formData.flowmeter_serial_number || '',
        flowmeter_units: formData.flowmeter_units || 'gallons',
        flowmeter_multiplier: formData.flowmeter_multiplier ? parseFloat(formData.flowmeter_multiplier) : 1.0,
        flowmeter_installation_date: formData.flowmeter_installation_date || null,
        
        // AMI telemetry
        has_ami: formData.has_ami ?? false,
        ami_vendor: formData.ami_vendor || '',
        ami_device_id: formData.ami_device_id || '',
        
        // Construction/permits
        well_construction_date: formData.well_construction_date || null,
        well_permit_number: formData.well_permit_number || '',
        
        // Status and compliance
        well_status: formData.status || 'active',
        is_de_minimis: formData.is_de_minimis ?? false,
        registered_with_gsa: formData.registered_with_gsa ?? false,
        gsa_registration_date: formData.gsa_registration_date || null,

        // GSA Fee Configuration
        base_extraction_rate: formData.base_extraction_rate ? parseFloat(formData.base_extraction_rate) : null,
        gsp_rate: formData.gsp_rate ? parseFloat(formData.gsp_rate) : null,
        domestic_rate: formData.domestic_rate ? parseFloat(formData.domestic_rate) : null,
        fixed_quarterly_fee: formData.fixed_quarterly_fee ? parseFloat(formData.fixed_quarterly_fee) : null,
        is_domestic_well: formData.is_domestic_well ?? false,
        owner_code: formData.owner_code || '',

        // Notes
        notes: formData.notes || '',
      };
      
      // Only include fields_served if it has values
      if (formData.fields_served && formData.fields_served.length > 0) {
        waterSourceData.fields_served = formData.fields_served;
      }
      
      console.log('Saving unified water source (well) data:', waterSourceData);
      
      // Save water source (create or update)
      if (wellSource?.id) {
        await api.put(`/water-sources/${wellSource.id}/`, waterSourceData);
        console.log('Water source (well) updated successfully');
      } else {
        const response = await api.post('/water-sources/', waterSourceData);
        console.log('Water source (well) created successfully:', response.data);
      }
      
      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving well:', err);
      const errorData = err.response?.data;
      if (errorData && typeof errorData === 'object') {
        setErrors(errorData);
      } else {
        setErrors({ general: 'Failed to save well. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Early return if not open
  // ---------------------------------------------------------------------------
  if (!isOpen) return null;

  // ---------------------------------------------------------------------------
  // Computed values
  // ---------------------------------------------------------------------------
  const farmFields = fields.filter(f => f.farm === parseInt(formData.farm));
  
  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: Droplets },
    { id: 'location', label: 'Location', icon: MapPin },
    { id: 'pump', label: 'Pump & Meter', icon: Gauge },
    { id: 'compliance', label: 'SGMA Compliance', icon: Building2 },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-cyan-50 to-blue-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-100 rounded-lg">
              <Droplets className="w-6 h-6 text-cyan-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {wellSource ? 'Edit Well' : 'Add New Well'}
              </h2>
              <p className="text-sm text-gray-500">Water source with SGMA compliance details</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-gray-50">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-cyan-600 text-cyan-600 bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-6">
            {/* General Error */}
            {errors.general && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{errors.general}</span>
              </div>
            )}

            {/* ========== BASIC INFO TAB ========== */}
            {activeTab === 'basic' && (
              <div className="space-y-6">
                {/* Farm Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Farm <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="farm"
                    value={formData.farm}
                    onChange={(e) => handleFarmChange(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${
                      errors.farm ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select a farm...</option>
                    {farms.map(farm => (
                      <option key={farm.id} value={farm.id}>{farm.name}</option>
                    ))}
                  </select>
                  {errors.farm && <p className="mt-1 text-sm text-red-600">{errors.farm}</p>}
                </div>

                {/* Well Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Well Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g., Well #1, North Well, Main Irrigation Well"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${
                      errors.name ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                </div>

                {/* GSA and Basin */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Groundwater Sustainability Agency (GSA) <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="gsa"
                      value={formData.gsa}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${
                        errors.gsa ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      {GSA_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Basin</label>
                    <select
                      name="basin"
                      value={formData.basin}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    >
                      {BASIN_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* GSA IDs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">GSA Well ID</label>
                    <input
                      type="text"
                      name="gsa_well_id"
                      value={formData.gsa_well_id}
                      onChange={handleChange}
                      placeholder="ID assigned by GSA"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">GSA Account Number</label>
                    <input
                      type="text"
                      name="gsa_account_number"
                      value={formData.gsa_account_number}
                      onChange={handleChange}
                      placeholder="Your account with GSA"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                </div>

                {/* Usage */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Water Usage</label>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="used_for_irrigation"
                        checked={formData.used_for_irrigation}
                        onChange={handleChange}
                        className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                      />
                      <span className="text-sm text-gray-700">Irrigation</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="used_for_washing"
                        checked={formData.used_for_washing}
                        onChange={handleChange}
                        className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                      />
                      <span className="text-sm text-gray-700">Produce Washing</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="used_for_pesticide_mixing"
                        checked={formData.used_for_pesticide_mixing}
                        onChange={handleChange}
                        className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                      />
                      <span className="text-sm text-gray-700">Pesticide Mixing</span>
                    </label>
                  </div>
                </div>

                {/* Fields Served */}
                {farmFields.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Fields Served</label>
                    <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
                      {farmFields.map(field => (
                        <label key={field.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.fields_served.includes(field.id)}
                            onChange={(e) => {
                              const newFields = e.target.checked
                                ? [...formData.fields_served, field.id]
                                : formData.fields_served.filter(id => id !== field.id);
                              setFormData(prev => ({ ...prev, fields_served: newFields }));
                            }}
                            className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                          />
                          <span className="text-sm text-gray-700">{field.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    >
                      {STATUS_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Water Test Frequency</label>
                    <select
                      name="test_frequency_days"
                      value={formData.test_frequency_days}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value={90}>Quarterly (90 days)</option>
                      <option value={180}>Semi-annually (180 days)</option>
                      <option value={365}>Annually (365 days)</option>
                    </select>
                  </div>
                </div>

                {/* Well Characteristics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Well Depth (ft)</label>
                    <input
                      type="number"
                      name="well_depth_ft"
                      value={formData.well_depth_ft}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Casing Diameter (in)</label>
                    <input
                      type="number"
                      name="casing_diameter_inches"
                      value={formData.casing_diameter_inches}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State Well Number</label>
                    <input
                      type="text"
                      name="state_well_number"
                      value={formData.state_well_number}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Any additional notes about this well..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>
            )}

            {/* ========== LOCATION TAB ========== */}
            {activeTab === 'location' && (
              <div className="space-y-6">
                {/* Location Source Toggle */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-blue-800">
                        By default, the well location is derived from the selected farm. 
                        Toggle "Specify exact location" to set a custom GPS position.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Toggle Custom Location */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Specify exact well location</p>
                    <p className="text-sm text-gray-500">
                      {useCustomLocation 
                        ? 'Using custom GPS coordinates' 
                        : selectedFarm 
                          ? `Using location from ${selectedFarm.name}`
                          : 'Select a farm first'}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useCustomLocation}
                      onChange={(e) => handleCustomLocationToggle(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                  </label>
                </div>

                {/* GPS Coordinates */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">GPS Coordinates</label>
                    {useCustomLocation && (
                      <button
                        type="button"
                        onClick={getCurrentLocation}
                        className="flex items-center gap-1 text-sm text-cyan-600 hover:text-cyan-700"
                      >
                        <Crosshair className="w-4 h-4" />
                        Use Current Location
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Latitude</label>
                      <input
                        type="number"
                        name="gps_latitude"
                        value={formData.gps_latitude}
                        onChange={handleChange}
                        step="0.0000001"
                        placeholder="34.4472"
                        disabled={!useCustomLocation}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 ${
                          !useCustomLocation ? 'bg-gray-100 text-gray-500' : ''
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Longitude</label>
                      <input
                        type="number"
                        name="gps_longitude"
                        value={formData.gps_longitude}
                        onChange={handleChange}
                        step="0.0000001"
                        placeholder="-119.2429"
                        disabled={!useCustomLocation}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 ${
                          !useCustomLocation ? 'bg-gray-100 text-gray-500' : ''
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* PLSS */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">PLSS (Township, Range, Section)</label>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Township</label>
                      <input
                        type="text"
                        name="township"
                        value={formData.township}
                        onChange={handleChange}
                        placeholder="e.g., T4N"
                        disabled={!useCustomLocation}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 ${
                          !useCustomLocation ? 'bg-gray-100 text-gray-500' : ''
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Range</label>
                      <input
                        type="text"
                        name="range_value"
                        value={formData.range_value}
                        onChange={handleChange}
                        placeholder="e.g., R22W"
                        disabled={!useCustomLocation}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 ${
                          !useCustomLocation ? 'bg-gray-100 text-gray-500' : ''
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Section</label>
                      <input
                        type="text"
                        name="section"
                        value={formData.section}
                        onChange={handleChange}
                        placeholder="e.g., 15"
                        disabled={!useCustomLocation}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 ${
                          !useCustomLocation ? 'bg-gray-100 text-gray-500' : ''
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Parcel APN */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Parcel APN</label>
                  <input
                    type="text"
                    name="parcel_apn"
                    value={formData.parcel_apn}
                    onChange={handleChange}
                    placeholder="Assessor's Parcel Number"
                    disabled={!useCustomLocation}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 ${
                      !useCustomLocation ? 'bg-gray-100 text-gray-500' : ''
                    }`}
                  />
                </div>

                {/* Construction Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Construction Date</label>
                    <input
                      type="date"
                      name="well_construction_date"
                      value={formData.well_construction_date}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Well Permit Number</label>
                    <input
                      type="text"
                      name="well_permit_number"
                      value={formData.well_permit_number}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                </div>

                {/* Location Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location Description</label>
                  <textarea
                    name="location_description"
                    value={formData.location_description}
                    onChange={handleChange}
                    rows={2}
                    placeholder="e.g., Northeast corner of the property, 50 ft from barn"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>
            )}

            {/* ========== PUMP & METER TAB ========== */}
            {activeTab === 'pump' && (
              <div className="space-y-6">
                {/* Pump Information */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Pump Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Pump Type</label>
                      <select
                        name="pump_type"
                        value={formData.pump_type}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      >
                        {PUMP_TYPE_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Horsepower</label>
                      <input
                        type="number"
                        name="pump_horsepower"
                        value={formData.pump_horsepower}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Flow Rate (GPM)</label>
                      <input
                        type="number"
                        name="pump_flow_rate_gpm"
                        value={formData.pump_flow_rate_gpm}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Power */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Power Source</label>
                    <select
                      name="power_source"
                      value={formData.power_source}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    >
                      {POWER_SOURCE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Utility Meter Number</label>
                    <input
                      type="text"
                      name="utility_meter_number"
                      value={formData.utility_meter_number}
                      onChange={handleChange}
                      placeholder="Electric/Gas meter ID"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                </div>

                {/* Flowmeter */}
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-900">Flowmeter</h3>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="has_flowmeter"
                        checked={formData.has_flowmeter}
                        onChange={handleChange}
                        className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                      />
                      <span className="text-sm text-gray-700">Has Flowmeter</span>
                    </label>
                  </div>

                  {formData.has_flowmeter && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Make</label>
                          <input
                            type="text"
                            name="flowmeter_make"
                            value={formData.flowmeter_make}
                            onChange={handleChange}
                            placeholder="e.g., McCrometer"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Model</label>
                          <input
                            type="text"
                            name="flowmeter_model"
                            value={formData.flowmeter_model}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Serial Number</label>
                          <input
                            type="text"
                            name="flowmeter_serial_number"
                            value={formData.flowmeter_serial_number}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Units</label>
                          <select
                            name="flowmeter_units"
                            value={formData.flowmeter_units}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                          >
                            {FLOWMETER_UNIT_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Multiplier</label>
                          <input
                            type="number"
                            name="flowmeter_multiplier"
                            value={formData.flowmeter_multiplier}
                            onChange={handleChange}
                            step="0.0001"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                          />
                          <p className="mt-1 text-xs text-gray-500">Factor to multiply reading by</p>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Install Date</label>
                          <input
                            type="date"
                            name="flowmeter_installation_date"
                            value={formData.flowmeter_installation_date}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* AMI (Automated Meter Infrastructure) */}
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Automated Meter Reading (AMI)</h3>
                      <p className="text-xs text-gray-500">Telemetry for automatic meter readings</p>
                    </div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="has_ami"
                        checked={formData.has_ami}
                        onChange={handleChange}
                        className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                      />
                      <span className="text-sm text-gray-700">Has AMI</span>
                    </label>
                  </div>

                  {formData.has_ami && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">AMI Vendor</label>
                        <input
                          type="text"
                          name="ami_vendor"
                          value={formData.ami_vendor}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Device ID</label>
                        <input
                          type="text"
                          name="ami_device_id"
                          value={formData.ami_device_id}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ========== COMPLIANCE TAB ========== */}
            {activeTab === 'compliance' && (
              <div className="space-y-6">
                {/* Registration Status */}
                <div className="space-y-4">
                  <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      name="registered_with_gsa"
                      checked={formData.registered_with_gsa}
                      onChange={handleChange}
                      className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 w-5 h-5"
                    />
                    <div className="flex-1">
                      <span className="font-medium text-gray-900">Registered with GSA</span>
                      <p className="text-sm text-gray-500">Well is registered with the Groundwater Sustainability Agency</p>
                    </div>
                    {formData.registered_with_gsa && (
                      <CheckCircle className="w-5 h-5 text-primary" />
                    )}
                  </label>

                  <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      name="is_de_minimis"
                      checked={formData.is_de_minimis}
                      onChange={handleChange}
                      className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 w-5 h-5"
                    />
                    <div className="flex-1">
                      <span className="font-medium text-gray-900">De Minimis Extractor</span>
                      <p className="text-sm text-gray-500">Less than 2 acre-feet per year for domestic use</p>
                    </div>
                  </label>
                </div>

                {/* Registration Date */}
                {formData.registered_with_gsa && (
                  <div className="max-w-xs">
                    <label className="block text-sm font-medium text-gray-700 mb-1">GSA Registration Date</label>
                    <input
                      type="date"
                      name="gsa_registration_date"
                      value={formData.gsa_registration_date}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                )}

                {/* Basin Priority */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Basin Priority Level</label>
                  <select
                    name="basin_priority"
                    value={formData.basin_priority}
                    onChange={handleChange}
                    className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="critical">Critically Overdrafted</option>
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                    <option value="very_low">Very Low Priority</option>
                  </select>
                </div>

                {/* GSA Fee Configuration */}
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">GSA Fee Configuration</h3>
                    {gsaFeeDefaults[formData.gsa] && (
                      <button
                        type="button"
                        onClick={applyGsaFeeDefaults}
                        className="text-sm text-cyan-600 hover:text-cyan-700 hover:underline"
                      >
                        Apply {gsaFeeDefaults[formData.gsa]?.display_name || formData.gsa.toUpperCase()} Defaults
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    Set the fee rates charged by your GSA. Fees will be auto-calculated when entering meter readings.
                  </p>

                  {/* Domestic Well Toggle */}
                  <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer mb-4">
                    <input
                      type="checkbox"
                      name="is_domestic_well"
                      checked={formData.is_domestic_well}
                      onChange={handleChange}
                      className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 w-5 h-5"
                    />
                    <div className="flex-1">
                      <span className="font-medium text-gray-900">Domestic Well</span>
                      <p className="text-sm text-gray-500">Well is primarily for domestic use (may have different rates)</p>
                    </div>
                  </label>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Base Extraction Rate ($/AF)</label>
                      <input
                        type="number"
                        name="base_extraction_rate"
                        value={formData.base_extraction_rate}
                        onChange={handleChange}
                        step="0.01"
                        placeholder="e.g., 192.34 for UWCD, 25 for OBGMA"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">GSP/SGMA Fee Rate ($/AF)</label>
                      <input
                        type="number"
                        name="gsp_rate"
                        value={formData.gsp_rate}
                        onChange={handleChange}
                        step="0.01"
                        placeholder="e.g., 100 for OBGMA"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Domestic Rate ($/AF)</label>
                      <input
                        type="number"
                        name="domestic_rate"
                        value={formData.domestic_rate}
                        onChange={handleChange}
                        step="0.01"
                        placeholder="e.g., 214.22 for UWCD"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Fixed Quarterly Fee ($)</label>
                      <input
                        type="number"
                        name="fixed_quarterly_fee"
                        value={formData.fixed_quarterly_fee}
                        onChange={handleChange}
                        step="0.01"
                        placeholder="e.g., 70 for OBGMA"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm text-gray-600 mb-1">Owner Code</label>
                    <input
                      type="text"
                      name="owner_code"
                      value={formData.owner_code}
                      onChange={handleChange}
                      placeholder="e.g., JPF, FF, RMLF"
                      className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">Owner identifier code used for GSA reporting</p>
                  </div>
                </div>

                {/* SGMA Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    <Info className="w-5 h-5" />
                    SGMA Compliance Requirements
                  </h4>
                  <ul className="text-sm text-blue-800 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      <span>All non-de minimis wells require meter calibration every 3 years</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      <span>Semi-annual extraction reports due April 1 and October 1</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      <span>Flowmeter accuracy must be within ±5%</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      <span>Monthly meter readings recommended for accurate tracking</span>
                    </li>
                  </ul>
                </div>

                {/* Water Year Info */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">California Water Year</h4>
                  <p className="text-sm text-gray-600">
                    The water year runs from <strong>October 1</strong> to <strong>September 30</strong>. 
                    For example, Water Year 2025 runs from October 1, 2024 to September 30, 2025.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {wellSource ? 'Update Well' : 'Create Well'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WellSourceModal;
