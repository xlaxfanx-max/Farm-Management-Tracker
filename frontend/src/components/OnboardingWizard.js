import React, { useState, useEffect, useCallback } from 'react';
import { 
  Building2, 
  MapPin, 
  Layers, 
  Droplets, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft,
  Leaf,
  TreeDeciduous,
  Map,
  Plus,
  Trash2,
  Info,
  Sparkles,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { MapContainer, TileLayer, FeatureGroup, Polygon, useMap } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import { farmsAPI, fieldsAPI, waterSourcesAPI } from '../services/api';

// County data for California with GSA associations
const CALIFORNIA_COUNTIES = [
  { value: 'ventura', label: 'Ventura', gsas: ['obgma', 'fpbgsa', 'uvrga', 'fcgma'] },
  { value: 'los_angeles', label: 'Los Angeles', gsas: [] },
  { value: 'orange', label: 'Orange', gsas: [] },
  { value: 'san_diego', label: 'San Diego', gsas: [] },
  { value: 'riverside', label: 'Riverside', gsas: [] },
  { value: 'san_bernardino', label: 'San Bernardino', gsas: [] },
  { value: 'kern', label: 'Kern', gsas: [] },
  { value: 'fresno', label: 'Fresno', gsas: [] },
  { value: 'tulare', label: 'Tulare', gsas: [] },
  { value: 'santa_barbara', label: 'Santa Barbara', gsas: [] },
];

const CROP_TYPES = [
  { value: 'citrus_navels', label: 'Citrus - Navels', icon: '🍊' },
  { value: 'citrus_valencias', label: 'Citrus - Valencias', icon: '🍊' },
  { value: 'citrus_lemons', label: 'Citrus - Lemons', icon: '🍋' },
  { value: 'citrus_limes', label: 'Citrus - Limes', icon: '🍈' },
  { value: 'citrus_grapefruit', label: 'Citrus - Grapefruit', icon: '🍊' },
  { value: 'citrus_mandarins', label: 'Citrus - Mandarins', icon: '🍊' },
  { value: 'avocado_hass', label: 'Avocado - Hass', icon: '🥑' },
  { value: 'avocado_other', label: 'Avocado - Other', icon: '🥑' },
  { value: 'other', label: 'Other', icon: '🌱' },
];

const GSA_OPTIONS = [
  { value: 'obgma', label: 'Ojai Basin GMA', basin: 'Ojai Valley' },
  { value: 'fpbgsa', label: 'Fillmore & Piru Basins GSA', basin: 'Fillmore, Piru' },
  { value: 'uvrga', label: 'Upper Ventura River GA', basin: 'Upper Ventura River' },
  { value: 'fcgma', label: 'Fox Canyon GMA', basin: 'Oxnard, Pleasant Valley, Las Posas' },
];

// Step indicator component
const StepIndicator = ({ steps, currentStep, completedSteps }) => {
  return (
    <div className="step-indicator">
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isCompleted = completedSteps.includes(index);
        const isPast = index < currentStep;
        
        return (
          <div key={step.id} className="step-item">
            <div className={`step-circle ${isActive ? 'active' : ''} ${isCompleted || isPast ? 'completed' : ''}`}>
              {isCompleted || isPast ? (
                <CheckCircle2 size={20} />
              ) : (
                <step.icon size={20} />
              )}
            </div>
            <span className={`step-label ${isActive ? 'active' : ''}`}>{step.label}</span>
            {index < steps.length - 1 && (
              <div className={`step-connector ${isPast ? 'completed' : ''}`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

// Map component for boundary drawing
const BoundaryMap = ({ center, zoom, boundary, onBoundaryChange, farmBoundary }) => {
  const MapController = () => {
    const map = useMap();
    
    useEffect(() => {
      if (center) {
        map.setView(center, zoom || 15);
      }
    }, [center, zoom, map]);
    
    return null;
  };

  const handleCreated = (e) => {
    const layer = e.layer;
    const latlngs = layer.getLatLngs()[0];
    const coordinates = latlngs.map(ll => [ll.lng, ll.lat]);
    coordinates.push(coordinates[0]); // Close the polygon
    
    onBoundaryChange({
      type: 'Polygon',
      coordinates: [coordinates]
    });
  };

  const handleDeleted = () => {
    onBoundaryChange(null);
  };

  return (
    <MapContainer
      center={center || [34.45, -119.25]}
      zoom={zoom || 13}
      className="boundary-map"
    >
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution="Esri"
      />
      <MapController />
      
      {/* Show farm boundary as reference when drawing fields */}
      {farmBoundary && (
        <Polygon
          positions={farmBoundary.coordinates[0].map(coord => [coord[1], coord[0]])}
          pathOptions={{ color: '#10b981', fillOpacity: 0.1, weight: 2, dashArray: '5, 5' }}
        />
      )}
      
      {/* Show existing boundary */}
      {boundary && (
        <Polygon
          positions={boundary.coordinates[0].map(coord => [coord[1], coord[0]])}
          pathOptions={{ color: '#f59e0b', fillOpacity: 0.3, weight: 3 }}
        />
      )}
      
      <FeatureGroup>
        <EditControl
          position="topright"
          onCreated={handleCreated}
          onDeleted={handleDeleted}
          draw={{
            rectangle: false,
            circle: false,
            circlemarker: false,
            marker: false,
            polyline: false,
            polygon: {
              allowIntersection: false,
              shapeOptions: {
                color: '#f59e0b',
                fillOpacity: 0.3
              }
            }
          }}
        />
      </FeatureGroup>
    </MapContainer>
  );
};

// Step 1: Company & Farm Info
const StepCompanyFarm = ({ data, onChange, errors }) => {
  return (
    <div className="step-content">
      <div className="step-header">
        <div className="step-icon-large">
          <Building2 size={32} />
        </div>
        <h2>Let's set up your farm</h2>
        <p>Tell us about your operation. This information helps us customize your compliance reports.</p>
      </div>
      
      <div className="form-grid">
        <div className="form-group full-width">
          <label>Farm Name <span className="required">*</span></label>
          <input
            type="text"
            value={data.farmName || ''}
            onChange={(e) => onChange({ farmName: e.target.value })}
            placeholder="e.g., Ojai Valley Ranch"
            className={errors.farmName ? 'error' : ''}
          />
          {errors.farmName && <span className="error-text">{errors.farmName}</span>}
        </div>
        
        <div className="form-group">
          <label>County <span className="required">*</span></label>
          <select
            value={data.county || ''}
            onChange={(e) => onChange({ county: e.target.value })}
            className={errors.county ? 'error' : ''}
          >
            <option value="">Select county...</option>
            {CALIFORNIA_COUNTIES.map(county => (
              <option key={county.value} value={county.value}>{county.label}</option>
            ))}
          </select>
          {errors.county && <span className="error-text">{errors.county}</span>}
        </div>
        
        <div className="form-group">
          <label>Primary Crop</label>
          <select
            value={data.primaryCrop || ''}
            onChange={(e) => onChange({ primaryCrop: e.target.value })}
          >
            <option value="">Select primary crop...</option>
            {CROP_TYPES.map(crop => (
              <option key={crop.value} value={crop.value}>{crop.icon} {crop.label}</option>
            ))}
          </select>
        </div>
        
        <div className="form-group full-width">
          <label>Farm Address</label>
          <input
            type="text"
            value={data.address || ''}
            onChange={(e) => onChange({ address: e.target.value })}
            placeholder="e.g., 1234 Orchard Lane, Ojai, CA 93023"
          />
          <span className="helper-text">
            <MapPin size={14} /> Used for location lookup and PLSS coordinates
          </span>
        </div>
      </div>
      
      <div className="info-card">
        <Info size={20} />
        <div>
          <strong>Why we ask for county</strong>
          <p>California's groundwater regulations vary by basin. We'll automatically suggest the right Groundwater Sustainability Agency (GSA) for your wells based on your county.</p>
        </div>
      </div>
    </div>
  );
};

// Step 2: Farm Boundary & Parcels
const StepBoundaryParcels = ({ data, onChange, errors }) => {
  const [mapCenter, setMapCenter] = useState([34.45, -119.25]);
  const [newAPN, setNewAPN] = useState('');

  const handleAddressLookup = async () => {
    if (!data.address) return;
    
    try {
      // Using Nominatim for geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(data.address)}`
      );
      const results = await response.json();
      
      if (results.length > 0) {
        const { lat, lon } = results[0];
        setMapCenter([parseFloat(lat), parseFloat(lon)]);
        onChange({ 
          latitude: parseFloat(lat), 
          longitude: parseFloat(lon) 
        });
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    }
  };

  const handleAddParcel = () => {
    if (!newAPN.trim()) return;
    
    const parcels = data.parcels || [];
    if (!parcels.includes(newAPN.trim())) {
      onChange({ parcels: [...parcels, newAPN.trim()] });
    }
    setNewAPN('');
  };

  const handleRemoveParcel = (apn) => {
    const parcels = data.parcels || [];
    onChange({ parcels: parcels.filter(p => p !== apn) });
  };

  return (
    <div className="step-content">
      <div className="step-header">
        <div className="step-icon-large">
          <Map size={32} />
        </div>
        <h2>Map your farm boundary</h2>
        <p>Draw your farm's boundary on the satellite map. This enables automatic PLSS lookup for PUR compliance.</p>
      </div>
      
      <div className="map-section">
        <div className="map-controls">
          <button 
            type="button" 
            className="btn-secondary"
            onClick={handleAddressLookup}
            disabled={!data.address}
          >
            <MapPin size={16} />
            Go to Address
          </button>
          <span className="map-hint">Use the polygon tool to draw your farm boundary</span>
        </div>
        
        <BoundaryMap
          center={mapCenter}
          zoom={15}
          boundary={data.boundary}
          onBoundaryChange={(boundary) => onChange({ boundary })}
        />
        
        {data.boundary && (
          <div className="boundary-success">
            <CheckCircle2 size={16} />
            Farm boundary set! PLSS coordinates will be automatically calculated.
          </div>
        )}
      </div>
      
      <div className="parcels-section">
        <h3>Assessor's Parcel Numbers (APNs)</h3>
        <p className="section-description">
          Add the APNs associated with this farm. You can find these on your property tax bill.
        </p>
        
        <div className="parcel-input-row">
          <input
            type="text"
            value={newAPN}
            onChange={(e) => setNewAPN(e.target.value)}
            placeholder="e.g., 052-0-123-456"
            onKeyPress={(e) => e.key === 'Enter' && handleAddParcel()}
          />
          <button type="button" className="btn-add" onClick={handleAddParcel}>
            <Plus size={16} />
            Add
          </button>
        </div>
        
        {(data.parcels || []).length > 0 && (
          <div className="parcel-list">
            {data.parcels.map((apn, index) => (
              <div key={index} className="parcel-tag">
                <span>{apn}</span>
                <button type="button" onClick={() => handleRemoveParcel(apn)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        
        <div className="help-link">
          <ExternalLink size={14} />
          <a href="https://www.ventura.org/assessor/" target="_blank" rel="noopener noreferrer">
            Look up APNs on Ventura County Assessor
          </a>
        </div>
      </div>
    </div>
  );
};

// Step 3: Fields
const StepFields = ({ data, onChange, errors }) => {
  const [editingField, setEditingField] = useState(null);
  const [showFieldForm, setShowFieldForm] = useState(false);
  const [fieldForm, setFieldForm] = useState({
    name: '',
    crop: '',
    variety: '',
    acres: '',
    plantedYear: ''
  });

  const handleSaveField = () => {
    if (!fieldForm.name || !fieldForm.acres) return;
    
    const fields = data.fields || [];
    const newField = {
      ...fieldForm,
      id: editingField !== null ? editingField : Date.now(),
      acres: parseFloat(fieldForm.acres)
    };
    
    if (editingField !== null) {
      onChange({ 
        fields: fields.map((f, i) => i === editingField ? newField : f) 
      });
    } else {
      onChange({ fields: [...fields, newField] });
    }
    
    setFieldForm({ name: '', crop: '', variety: '', acres: '', plantedYear: '' });
    setShowFieldForm(false);
    setEditingField(null);
  };

  const handleRemoveField = (index) => {
    const fields = data.fields || [];
    onChange({ fields: fields.filter((_, i) => i !== index) });
  };

  const totalAcres = (data.fields || []).reduce((sum, f) => sum + (f.acres || 0), 0);

  return (
    <div className="step-content">
      <div className="step-header">
        <div className="step-icon-large">
          <Layers size={32} />
        </div>
        <h2>Add your fields</h2>
        <p>Break down your farm into individual fields or blocks. This is essential for accurate pesticide and fertilizer tracking.</p>
      </div>
      
      {(data.fields || []).length > 0 && (
        <div className="fields-summary">
          <div className="summary-stat">
            <span className="stat-value">{data.fields.length}</span>
            <span className="stat-label">Fields</span>
          </div>
          <div className="summary-stat">
            <span className="stat-value">{totalAcres.toFixed(1)}</span>
            <span className="stat-label">Total Acres</span>
          </div>
        </div>
      )}
      
      <div className="fields-list">
        {(data.fields || []).map((field, index) => (
          <div key={field.id || index} className="field-card">
            <div className="field-icon">
              <TreeDeciduous size={24} />
            </div>
            <div className="field-info">
              <h4>{field.name}</h4>
              <p>
                {CROP_TYPES.find(c => c.value === field.crop)?.label || field.crop || 'No crop specified'}
                {field.variety && ` - ${field.variety}`}
              </p>
            </div>
            <div className="field-acres">
              {field.acres} acres
            </div>
            <button 
              type="button" 
              className="btn-icon"
              onClick={() => handleRemoveField(index)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        
        {!showFieldForm ? (
          <button 
            type="button" 
            className="btn-add-field"
            onClick={() => setShowFieldForm(true)}
          >
            <Plus size={20} />
            <span>Add Field</span>
          </button>
        ) : (
          <div className="field-form-card">
            <h4>New Field</h4>
            <div className="field-form-grid">
              <div className="form-group">
                <label>Field Name <span className="required">*</span></label>
                <input
                  type="text"
                  value={fieldForm.name}
                  onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })}
                  placeholder="e.g., Block A, North Grove"
                />
              </div>
              
              <div className="form-group">
                <label>Acres <span className="required">*</span></label>
                <input
                  type="number"
                  step="0.1"
                  value={fieldForm.acres}
                  onChange={(e) => setFieldForm({ ...fieldForm, acres: e.target.value })}
                  placeholder="e.g., 12.5"
                />
              </div>
              
              <div className="form-group">
                <label>Crop Type</label>
                <select
                  value={fieldForm.crop}
                  onChange={(e) => setFieldForm({ ...fieldForm, crop: e.target.value })}
                >
                  <option value="">Select crop...</option>
                  {CROP_TYPES.map(crop => (
                    <option key={crop.value} value={crop.value}>{crop.label}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label>Variety</label>
                <input
                  type="text"
                  value={fieldForm.variety}
                  onChange={(e) => setFieldForm({ ...fieldForm, variety: e.target.value })}
                  placeholder="e.g., Washington, Cara Cara"
                />
              </div>
              
              <div className="form-group">
                <label>Year Planted</label>
                <input
                  type="number"
                  value={fieldForm.plantedYear}
                  onChange={(e) => setFieldForm({ ...fieldForm, plantedYear: e.target.value })}
                  placeholder="e.g., 2015"
                />
              </div>
            </div>
            
            <div className="field-form-actions">
              <button 
                type="button" 
                className="btn-secondary"
                onClick={() => {
                  setShowFieldForm(false);
                  setFieldForm({ name: '', crop: '', variety: '', acres: '', plantedYear: '' });
                }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-primary"
                onClick={handleSaveField}
                disabled={!fieldForm.name || !fieldForm.acres}
              >
                Add Field
              </button>
            </div>
          </div>
        )}
      </div>
      
      {errors.fields && <span className="error-text">{errors.fields}</span>}
    </div>
  );
};

// Step 4: Water Sources
const StepWaterSources = ({ data, onChange, errors }) => {
  const [waterOption, setWaterOption] = useState(data.waterOption || '');
  const [wellForm, setWellForm] = useState({
    name: '',
    stateWellNumber: '',
    gsa: '',
    hasFlowmeter: true
  });
  const [showWellForm, setShowWellForm] = useState(false);

  const handleOptionChange = (option) => {
    setWaterOption(option);
    onChange({ waterOption: option });
    
    if (option === 'add_now') {
      setShowWellForm(true);
    } else {
      setShowWellForm(false);
    }
  };

  const handleAddWell = () => {
    if (!wellForm.name) return;
    
    const wells = data.wells || [];
    onChange({ 
      wells: [...wells, { ...wellForm, id: Date.now() }] 
    });
    setWellForm({ name: '', stateWellNumber: '', gsa: '', hasFlowmeter: true });
  };

  const handleRemoveWell = (id) => {
    const wells = data.wells || [];
    onChange({ wells: wells.filter(w => w.id !== id) });
  };

  const countyGSAs = GSA_OPTIONS.filter(gsa => {
    const county = CALIFORNIA_COUNTIES.find(c => c.value === data.county);
    return county?.gsas.includes(gsa.value);
  });

  return (
    <div className="step-content">
      <div className="step-header">
        <div className="step-icon-large">
          <Droplets size={32} />
        </div>
        <h2>Water sources & SGMA</h2>
        <p>California's Sustainable Groundwater Management Act (SGMA) requires well tracking and reporting for most agricultural operations.</p>
      </div>
      
      <div className="water-options">
        <label className={`water-option ${waterOption === 'add_now' ? 'selected' : ''}`}>
          <input
            type="radio"
            name="waterOption"
            value="add_now"
            checked={waterOption === 'add_now'}
            onChange={() => handleOptionChange('add_now')}
          />
          <div className="option-content">
            <Droplets size={24} />
            <div>
              <strong>Yes, add wells now</strong>
              <span>Set up SGMA tracking right away</span>
            </div>
          </div>
        </label>
        
        <label className={`water-option ${waterOption === 'add_later' ? 'selected' : ''}`}>
          <input
            type="radio"
            name="waterOption"
            value="add_later"
            checked={waterOption === 'add_later'}
            onChange={() => handleOptionChange('add_later')}
          />
          <div className="option-content">
            <ChevronRight size={24} />
            <div>
              <strong>I'll add wells later</strong>
              <span>Skip for now, add from Water Management</span>
            </div>
          </div>
        </label>
        
        <label className={`water-option ${waterOption === 'no_wells' ? 'selected' : ''}`}>
          <input
            type="radio"
            name="waterOption"
            value="no_wells"
            checked={waterOption === 'no_wells'}
            onChange={() => handleOptionChange('no_wells')}
          />
          <div className="option-content">
            <CheckCircle2 size={24} />
            <div>
              <strong>No wells / Not in SGMA basin</strong>
              <span>My operation uses municipal water or is exempt</span>
            </div>
          </div>
        </label>
      </div>
      
      {showWellForm && (
        <div className="wells-section">
          <h3>Your Wells</h3>
          
          {(data.wells || []).length > 0 && (
            <div className="wells-list">
              {data.wells.map(well => (
                <div key={well.id} className="well-card">
                  <Droplets size={20} />
                  <div className="well-info">
                    <strong>{well.name}</strong>
                    {well.stateWellNumber && <span>SWN: {well.stateWellNumber}</span>}
                    {well.gsa && <span>GSA: {GSA_OPTIONS.find(g => g.value === well.gsa)?.label}</span>}
                  </div>
                  <button type="button" onClick={() => handleRemoveWell(well.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className="well-form">
            <h4>Add Well</h4>
            <div className="well-form-grid">
              <div className="form-group">
                <label>Well Name <span className="required">*</span></label>
                <input
                  type="text"
                  value={wellForm.name}
                  onChange={(e) => setWellForm({ ...wellForm, name: e.target.value })}
                  placeholder="e.g., Main Well, North Well"
                />
              </div>
              
              <div className="form-group">
                <label>State Well Number</label>
                <input
                  type="text"
                  value={wellForm.stateWellNumber}
                  onChange={(e) => setWellForm({ ...wellForm, stateWellNumber: e.target.value })}
                  placeholder="e.g., 04N22W15A001S"
                />
              </div>
              
              {countyGSAs.length > 0 && (
                <div className="form-group">
                  <label>Groundwater Sustainability Agency</label>
                  <select
                    value={wellForm.gsa}
                    onChange={(e) => setWellForm({ ...wellForm, gsa: e.target.value })}
                  >
                    <option value="">Select GSA...</option>
                    {countyGSAs.map(gsa => (
                      <option key={gsa.value} value={gsa.value}>
                        {gsa.label} ({gsa.basin})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={wellForm.hasFlowmeter}
                    onChange={(e) => setWellForm({ ...wellForm, hasFlowmeter: e.target.checked })}
                  />
                  <span>Has flowmeter installed</span>
                </label>
              </div>
            </div>
            
            <button 
              type="button" 
              className="btn-secondary"
              onClick={handleAddWell}
              disabled={!wellForm.name}
            >
              <Plus size={16} />
              Add Well
            </button>
          </div>
        </div>
      )}
      
      <div className="info-card">
        <Info size={20} />
        <div>
          <strong>SGMA Requirements</strong>
          <p>Most agricultural wells in California must be registered with their local GSA and report extractions semi-annually. We'll help you track meter readings and generate reports.</p>
        </div>
      </div>
    </div>
  );
};

// Step 5: Complete
const StepComplete = ({ data, onStartUsing, onAddAnotherFarm }) => {
  const totalAcres = (data.fields || []).reduce((sum, f) => sum + (f.acres || 0), 0);
  const wellCount = (data.wells || []).length;
  
  return (
    <div className="step-content complete-step">
      <div className="complete-header">
        <div className="complete-icon">
          <Sparkles size={48} />
        </div>
        <h2>You're all set!</h2>
        <p><strong>{data.farmName}</strong> is ready for tracking.</p>
      </div>
      
      <div className="complete-summary">
        <div className="summary-card">
          <div className="summary-icon">
            <Building2 size={24} />
          </div>
          <div className="summary-details">
            <span className="summary-label">Farm</span>
            <span className="summary-value">{data.farmName}</span>
            <span className="summary-meta">
              {CALIFORNIA_COUNTIES.find(c => c.value === data.county)?.label} County
            </span>
          </div>
        </div>
        
        <div className="summary-card">
          <div className="summary-icon">
            <Layers size={24} />
          </div>
          <div className="summary-details">
            <span className="summary-label">Fields</span>
            <span className="summary-value">{(data.fields || []).length} fields</span>
            <span className="summary-meta">{totalAcres.toFixed(1)} total acres</span>
          </div>
        </div>
        
        {wellCount > 0 && (
          <div className="summary-card">
            <div className="summary-icon">
              <Droplets size={24} />
            </div>
            <div className="summary-details">
              <span className="summary-label">Water Sources</span>
              <span className="summary-value">{wellCount} well{wellCount !== 1 ? 's' : ''}</span>
              <span className="summary-meta">SGMA tracking enabled</span>
            </div>
          </div>
        )}
        
        {(data.parcels || []).length > 0 && (
          <div className="summary-card">
            <div className="summary-icon">
              <Map size={24} />
            </div>
            <div className="summary-details">
              <span className="summary-label">Parcels</span>
              <span className="summary-value">{data.parcels.length} APN{data.parcels.length !== 1 ? 's' : ''}</span>
              <span className="summary-meta">{data.parcels.join(', ')}</span>
            </div>
          </div>
        )}
      </div>
      
      <div className="next-steps">
        <h3>What's next?</h3>
        <div className="next-steps-grid">
          <div className="next-step-card">
            <Leaf size={24} />
            <div>
              <strong>Record an Application</strong>
              <p>Log pesticide or fertilizer applications for compliance tracking</p>
            </div>
            <ArrowRight size={16} />
          </div>
          
          <div className="next-step-card">
            <TreeDeciduous size={24} />
            <div>
              <strong>Start a Harvest</strong>
              <p>Track yields, loads, and revenue by field</p>
            </div>
            <ArrowRight size={16} />
          </div>
        </div>
      </div>
      
      <div className="complete-actions">
        <button type="button" className="btn-secondary" onClick={onAddAnotherFarm}>
          <Plus size={18} />
          Add Another Farm
        </button>
        <button type="button" className="btn-primary" onClick={onStartUsing}>
          Go to Dashboard
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};

// Main Wizard Component
const OnboardingWizard = ({ onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  
  const [formData, setFormData] = useState({
    // Company/Farm info
    farmName: '',
    county: '',
    primaryCrop: '',
    address: '',
    
    // Boundary & Parcels
    boundary: null,
    latitude: null,
    longitude: null,
    parcels: [],
    
    // Fields
    fields: [],
    
    // Water
    waterOption: '',
    wells: []
  });

  const steps = [
    { id: 'company', label: 'Farm Info', icon: Building2 },
    { id: 'boundary', label: 'Boundary', icon: Map },
    { id: 'fields', label: 'Fields', icon: Layers },
    { id: 'water', label: 'Water', icon: Droplets },
    { id: 'complete', label: 'Complete', icon: CheckCircle2 },
  ];

  const updateFormData = (updates) => {
    setFormData(prev => ({ ...prev, ...updates }));
    // Clear errors for updated fields
    const errorKeys = Object.keys(updates);
    setErrors(prev => {
      const newErrors = { ...prev };
      errorKeys.forEach(key => delete newErrors[key]);
      return newErrors;
    });
  };

  const validateStep = (stepIndex) => {
    const newErrors = {};
    
    switch (stepIndex) {
      case 0: // Company/Farm
        if (!formData.farmName?.trim()) {
          newErrors.farmName = 'Farm name is required';
        }
        if (!formData.county) {
          newErrors.county = 'Please select a county';
        }
        break;
        
      case 1: // Boundary - optional, no validation
        break;
        
      case 2: // Fields
        if ((formData.fields || []).length === 0) {
          newErrors.fields = 'Please add at least one field';
        }
        break;
        
      case 3: // Water - optional
        break;
        
      default:
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    if (!validateStep(currentStep)) return;
    
    if (currentStep === steps.length - 2) {
      // Last step before complete - save everything
      await handleSaveAll();
    }
    
    setCompletedSteps(prev => [...new Set([...prev, currentStep])]);
    setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleSaveAll = async () => {
    setIsSubmitting(true);
    
    try {
      // 1. Create Farm
      const farmPayload = {
        name: formData.farmName,
        county: formData.county,
        address: formData.address,
        latitude: formData.latitude,
        longitude: formData.longitude,
        boundary: formData.boundary
      };
      
      const farmResponse = await farmsAPI.create(farmPayload);
      const farmId = farmResponse.data.id;
      
      // 2. Add Parcels
      if (formData.parcels?.length > 0) {
        await farmsAPI.bulkAddParcels(farmId, {
          apns: formData.parcels.map(apn => ({ apn }))
        });
      }
      
      // 3. Create Fields
      for (const field of formData.fields || []) {
        await fieldsAPI.create({
          farm: farmId,
          name: field.name,
          crop_type: field.crop,
          variety: field.variety,
          acres: field.acres,
          planted_year: field.plantedYear
        });
      }
      
      // 4. Create Wells
      for (const well of formData.wells || []) {
        await waterSourcesAPI.create({
          farm: farmId,
          name: well.name,
          source_type: 'well',
          state_well_number: well.stateWellNumber,
          gsa_code: well.gsa,
          has_flowmeter: well.hasFlowmeter
        });
      }
      
    } catch (error) {
      console.error('Error saving onboarding data:', error);
      setErrors({ submit: 'Failed to save. Please try again.' });
      setIsSubmitting(false);
      return;
    }
    
    setIsSubmitting(false);
  };

  const handleStartUsing = () => {
    onComplete?.();
  };

  const handleAddAnotherFarm = () => {
    setCurrentStep(0);
    setCompletedSteps([]);
    setFormData({
      farmName: '',
      county: formData.county, // Keep county for convenience
      primaryCrop: '',
      address: '',
      boundary: null,
      latitude: null,
      longitude: null,
      parcels: [],
      fields: [],
      waterOption: '',
      wells: []
    });
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <StepCompanyFarm data={formData} onChange={updateFormData} errors={errors} />;
      case 1:
        return <StepBoundaryParcels data={formData} onChange={updateFormData} errors={errors} />;
      case 2:
        return <StepFields data={formData} onChange={updateFormData} errors={errors} />;
      case 3:
        return <StepWaterSources data={formData} onChange={updateFormData} errors={errors} />;
      case 4:
        return (
          <StepComplete 
            data={formData} 
            onStartUsing={handleStartUsing}
            onAddAnotherFarm={handleAddAnotherFarm}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="onboarding-wizard">
      <div className="wizard-sidebar">
        <div className="sidebar-brand">
          <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32">
            <circle cx="24" cy="24" r="20" fill="#2D5016"/>
            <circle cx="24" cy="26" r="12" fill="#E8791D"/>
            <ellipse cx="24" cy="24" rx="8" ry="10" fill="#F4A934"/>
            <path d="M24 4C24 4 28 10 28 14C28 18 26 20 24 20C22 20 20 18 20 14C20 10 24 4 24 4Z" fill="#4A7A2A"/>
            <path d="M24 4C24 4 20 8 18 10" stroke="#2D5016" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span>Grove Master</span>
        </div>
        
        <StepIndicator 
          steps={steps}
          currentStep={currentStep}
          completedSteps={completedSteps}
        />
        
        <div className="sidebar-footer">
          <button type="button" className="btn-skip" onClick={onSkip}>
            Skip setup, I'll explore first
          </button>
        </div>
      </div>
      
      <div className="wizard-main">
        <div className="wizard-content">
          {renderStep()}
        </div>
        
        {currentStep < steps.length - 1 && (
          <div className="wizard-navigation">
            <button 
              type="button"
              className="btn-back"
              onClick={handleBack}
              disabled={currentStep === 0}
            >
              <ChevronLeft size={18} />
              Back
            </button>
            
            <div className="step-counter">
              Step {currentStep + 1} of {steps.length - 1}
            </div>
            
            <button 
              type="button"
              className="btn-next"
              onClick={handleNext}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                'Saving...'
              ) : currentStep === steps.length - 2 ? (
                <>
                  Complete Setup
                  <CheckCircle2 size={18} />
                </>
              ) : (
                <>
                  Continue
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          </div>
        )}
        
        {errors.submit && (
          <div className="submit-error">
            {errors.submit}
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingWizard;
