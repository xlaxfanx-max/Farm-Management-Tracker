import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, FeatureGroup } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import { MapPin, Maximize2, Minimize2, Layers, Pencil, Save, X, Locate } from 'lucide-react';

// Fix for default marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom farm marker icon
const createFarmIcon = (isSelected = false) => new L.DivIcon({
  className: 'custom-farm-marker',
  html: `
    <div style="
      background: ${isSelected ? '#2563eb' : '#16a34a'};
      width: 32px;
      height: 32px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <svg style="transform: rotate(45deg); width: 16px; height: 16px; color: white;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

// Custom field marker icon
const createFieldIcon = (color = '#f59e0b') => new L.DivIcon({
  className: 'custom-field-marker',
  html: `
    <div style="
      background: ${color};
      width: 24px;
      height: 24px;
      border-radius: 4px;
      border: 2px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    "></div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

// Field colors by crop type
const getFieldColor = (crop) => {
  const cropLower = (crop || '').toLowerCase();
  if (cropLower.includes('navel')) return { fill: '#f97316', stroke: '#ea580c' };
  if (cropLower.includes('valencia')) return { fill: '#fb923c', stroke: '#f97316' };
  if (cropLower.includes('lemon')) return { fill: '#fbbf24', stroke: '#f59e0b' };
  if (cropLower.includes('grapefruit')) return { fill: '#f472b6', stroke: '#ec4899' };
  if (cropLower.includes('lime')) return { fill: '#22c55e', stroke: '#16a34a' };
  if (cropLower.includes('mandarin') || cropLower.includes('tangerine')) return { fill: '#ff6b35', stroke: '#e85d2d' };
  return { fill: '#16a34a', stroke: '#15803d' };
};

// Calculate polygon area in acres
const calculateAcres = (latlngs) => {
  if (!latlngs || latlngs.length < 3) return 0;
  
  const coords = latlngs.map(p => [p.lat || p[0], p.lng || p[1]]);
  let area = 0;
  const n = coords.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const lat1 = coords[i][0] * Math.PI / 180;
    const lat2 = coords[j][0] * Math.PI / 180;
    const lng1 = coords[i][1] * Math.PI / 180;
    const lng2 = coords[j][1] * Math.PI / 180;
    area += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  
  const earthRadius = 6371000;
  area = Math.abs(area * earthRadius * earthRadius / 2);
  const acres = area * 0.000247105;
  
  return Math.round(acres * 100) / 100;
};

// Main FarmMap Component
const FarmMap = ({ 
  farms = [], 
  fields = [], 
  selectedFarmId = null,
  selectedFieldId = null,
  onFieldSelect,
  onFarmSelect,
  onBoundaryUpdate,
  height = '500px',
  drawingField = null,  // { id, name } - auto-start drawing for this field
  onDrawingComplete = null  // callback when drawing is done/cancelled
}) => {
  const [mapType, setMapType] = useState('satellite');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingFieldId, setDrawingFieldId] = useState(null);
  const [drawingFieldName, setDrawingFieldName] = useState('');
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [pendingBoundary, setPendingBoundary] = useState(null);
  const featureGroupRef = useRef(null);
  const mapRef = useRef(null);

  // Default center (Central California - Fresno area)
  const defaultCenter = [36.7378, -119.7871];
  const defaultZoom = 9;

  // Calculate center based on farms/fields with coordinates
  const getMapCenter = () => {
    const farmsWithCoords = farms.filter(f => f.gps_lat && f.gps_long);
    const fieldsWithCoords = fields.filter(f => f.gps_lat && f.gps_long);
    
    if (farmsWithCoords.length > 0) {
      const lat = farmsWithCoords.reduce((sum, f) => sum + parseFloat(f.gps_lat), 0) / farmsWithCoords.length;
      const lng = farmsWithCoords.reduce((sum, f) => sum + parseFloat(f.gps_long), 0) / farmsWithCoords.length;
      return [lat, lng];
    }
    if (fieldsWithCoords.length > 0) {
      const lat = fieldsWithCoords.reduce((sum, f) => sum + parseFloat(f.gps_lat), 0) / fieldsWithCoords.length;
      const lng = fieldsWithCoords.reduce((sum, f) => sum + parseFloat(f.gps_long), 0) / fieldsWithCoords.length;
      return [lat, lng];
    }
    return defaultCenter;
  };

  // Tile layer URLs
  const tileLayers = {
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri',
    },
    terrain: {
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenTopoMap',
    },
    street: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap',
    },
  };

  // Handle drawing creation
  const handleCreated = (e) => {
    console.log('[FarmMap] handleCreated - polygon drawn!');
    const { layer } = e;
    const latlngs = layer.getLatLngs()[0];
    console.log('[FarmMap] latlngs:', latlngs);
    const acres = calculateAcres(latlngs);
    console.log('[FarmMap] calculated acres:', acres);
    
    const geojson = {
      type: 'Polygon',
      coordinates: [latlngs.map(p => [p.lng, p.lat])],
    };
    console.log('[FarmMap] geojson:', geojson);
    
    setPendingBoundary({ geojson, acres, latlngs });
    console.log('[FarmMap] pendingBoundary set');
  };

  // Save boundary
  const saveBoundary = () => {
    console.log('[FarmMap] saveBoundary called');
    console.log('[FarmMap] pendingBoundary:', pendingBoundary);
    console.log('[FarmMap] drawingFieldId:', drawingFieldId);
    console.log('[FarmMap] onBoundaryUpdate exists:', !!onBoundaryUpdate);
    
    if (pendingBoundary && drawingFieldId && onBoundaryUpdate) {
      console.log('[FarmMap] Calling onBoundaryUpdate with:', {
        fieldId: drawingFieldId,
        geojson: pendingBoundary.geojson,
        acres: pendingBoundary.acres
      });
      onBoundaryUpdate(drawingFieldId, pendingBoundary.geojson, pendingBoundary.acres);
    } else {
      console.log('[FarmMap] NOT calling onBoundaryUpdate - missing data');
    }
    if (onDrawingComplete) {
      onDrawingComplete();
    }
    cancelDrawing();
  };

  // Cancel drawing
  const cancelDrawing = () => {
    setPendingBoundary(null);
    setIsDrawing(false);
    setDrawingFieldId(null);
    setDrawingFieldName('');
    if (featureGroupRef.current) {
      featureGroupRef.current.clearLayers();
    }
    if (onDrawingComplete) {
      onDrawingComplete();
    }
  };

  // Start drawing for a specific field
  const startDrawing = (fieldId, fieldName) => {
    console.log('[FarmMap] startDrawing called:', { fieldId, fieldName });
    // Close any open popups first
    if (mapRef.current) {
      mapRef.current.closePopup();
    }
    setIsDrawing(true);
    setDrawingFieldId(fieldId);
    setDrawingFieldName(fieldName);
    setPendingBoundary(null);
    console.log('[FarmMap] Drawing mode activated for field:', fieldName);
  };

  const mapHeight = isExpanded ? '100vh' : height;
  const center = getMapCenter();

  // Auto-start drawing when drawingField prop is passed
  useEffect(() => {
    if (drawingField && drawingField.id && drawingField.name) {
      startDrawing(drawingField.id, drawingField.name);
    }
  }, [drawingField]);

  return (
    <div 
      className={`relative rounded-xl overflow-hidden shadow-lg border border-gray-200 ${
        isExpanded ? 'fixed inset-0 z-50' : ''
      }`}
      style={{ height: mapHeight }}
    >
      {/* Map Controls */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="bg-white p-2.5 rounded-lg shadow-md hover:bg-gray-50 transition-colors"
          title={isExpanded ? 'Collapse map' : 'Expand map'}
        >
          {isExpanded ? <Minimize2 className="w-5 h-5 text-gray-700" /> : <Maximize2 className="w-5 h-5 text-gray-700" />}
        </button>

        <div className="relative">
          <button
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className="bg-white p-2.5 rounded-lg shadow-md hover:bg-gray-50 transition-colors"
            title="Map layers"
          >
            <Layers className="w-5 h-5 text-gray-700" />
          </button>
          
          {showLayerMenu && (
            <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-xl border border-gray-200 py-2">
              {Object.keys(tileLayers).map((type) => (
                <button
                  key={type}
                  onClick={() => { setMapType(type); setShowLayerMenu(false); }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${
                    mapType === type ? 'text-green-600 font-medium' : 'text-gray-700'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                  {mapType === type && <span className="text-green-500">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Drawing Controls */}
      {isDrawing && (
        <div className="absolute top-4 left-4 z-[1000] bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-w-xs">
          <div className="flex items-center gap-2 mb-3">
            <Pencil className="w-5 h-5 text-amber-500" />
            <span className="font-semibold text-gray-800">Drawing: {drawingFieldName}</span>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Click on the map to draw field boundaries. Click the first point again to close the polygon.
          </p>
          
          {pendingBoundary && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
              <div className="text-sm font-medium text-green-800">Boundary Drawn!</div>
              <div className="text-sm text-green-700">
                Calculated area: <strong>{pendingBoundary.acres} acres</strong>
              </div>
            </div>
          )}
          
          <div className="flex gap-2">
            {pendingBoundary && (
              <button
                onClick={saveBoundary}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            )}
            <button
              onClick={cancelDrawing}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Legend */}
      {!isDrawing && (
        <div className="absolute bottom-4 right-4 z-[1000] bg-white/95 backdrop-blur rounded-lg shadow-lg border border-gray-200 p-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Legend</div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full bg-green-600"></div>
              <span>Farm</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded bg-orange-500"></div>
              <span>Oranges</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded bg-yellow-400"></div>
              <span>Lemons</span>
            </div>
          </div>
        </div>
      )}

      {/* The Map */}
      <MapContainer
        center={center}
        zoom={defaultZoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        whenReady={(mapInstance) => {
          mapRef.current = mapInstance.target;
        }}
      >
        <TileLayer
          url={tileLayers[mapType].url}
          attribution={tileLayers[mapType].attribution}
          maxZoom={19}
        />

        {/* Farm Markers */}
        {farms.map((farm) => {
          if (!farm.gps_lat || !farm.gps_long) return null;
          const farmFields = fields.filter(f => parseInt(f.farm) === farm.id);
          return (
            <Marker
              key={`farm-${farm.id}`}
              position={[parseFloat(farm.gps_lat), parseFloat(farm.gps_long)]}
              icon={createFarmIcon(selectedFarmId === farm.id)}
              eventHandlers={{
                click: () => onFarmSelect && onFarmSelect(farm.id)
              }}
            >
              <Popup>
                <div className="min-w-[250px] max-h-[300px] overflow-y-auto">
                  <h3 className="font-bold text-lg text-gray-800">{farm.name}</h3>
                  <p className="text-sm text-gray-600">{farm.county} County</p>
                  
                  {farmFields.length > 0 ? (
                    <div className="mt-3 border-t pt-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Fields ({farmFields.length})</p>
                      <div className="space-y-2">
                        {farmFields.map(field => (
                          <div key={field.id} className="flex items-center justify-between bg-gray-50 rounded p-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-gray-800 truncate">{field.name}</p>
                              <p className="text-xs text-gray-500">{field.total_acres} acres · {field.current_crop || 'No crop'}</p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                startDrawing(field.id, field.name);
                              }}
                              className={`ml-2 px-2 py-1 rounded text-xs whitespace-nowrap ${
                                field.boundary_geojson 
                                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' 
                                  : 'bg-blue-600 text-white hover:bg-blue-700'
                              }`}
                            >
                              {field.boundary_geojson ? 'Redraw' : 'Draw'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 mt-2 italic">No fields added yet</p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Field Boundaries */}
        {fields.map((field) => {
          if (!field.boundary_geojson) return null;
          const colors = getFieldColor(field.current_crop);
          const coords = field.boundary_geojson.coordinates[0].map(c => [c[1], c[0]]);
          
          return (
            <Polygon
              key={`boundary-${field.id}`}
              positions={coords}
              pathOptions={{
                color: colors.stroke,
                fillColor: colors.fill,
                fillOpacity: 0.4,
                weight: selectedFieldId === field.id ? 3 : 2,
              }}
              eventHandlers={{
                click: () => onFieldSelect && onFieldSelect(field.id)
              }}
            >
              <Popup>
                <div className="min-w-[200px]">
                  <h3 className="font-bold text-lg text-gray-800">{field.name}</h3>
                  <p className="text-sm text-gray-600">{field.current_crop || 'No crop'}</p>
                  <p className="text-sm text-gray-500">{field.total_acres} acres</p>
                  <button
                    onClick={() => startDrawing(field.id, field.name)}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 text-sm font-medium"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Redraw Boundary
                  </button>
                </div>
              </Popup>
            </Polygon>
          );
        })}

        {/* Field Markers (for fields without boundaries) */}
        {fields.map((field) => {
          if (field.boundary_geojson) return null;
          if (!field.gps_lat || !field.gps_long) return null;
          
          const colors = getFieldColor(field.current_crop);
          return (
            <Marker
              key={`field-${field.id}`}
              position={[parseFloat(field.gps_lat), parseFloat(field.gps_long)]}
              icon={createFieldIcon(colors.fill)}
              eventHandlers={{
                click: () => onFieldSelect && onFieldSelect(field.id)
              }}
            >
              <Popup>
                <div className="min-w-[200px]">
                  <h3 className="font-bold text-lg text-gray-800">{field.name}</h3>
                  <p className="text-sm text-gray-600">{field.current_crop || 'No crop'}</p>
                  <p className="text-sm text-gray-500">{field.total_acres} acres</p>
                  <button
                    onClick={() => startDrawing(field.id, field.name)}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm font-medium"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Draw Boundary
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Drawing Feature Group */}
        {isDrawing && (
          <FeatureGroup ref={featureGroupRef}>
            <EditControl
              position="topleft"
              onCreated={handleCreated}
              draw={{
                rectangle: false,
                circle: false,
                circlemarker: false,
                marker: false,
                polyline: false,
                polygon: {
                  allowIntersection: false,
                  shapeOptions: {
                    color: '#3b82f6',
                    fillColor: '#3b82f6',
                    fillOpacity: 0.3,
                  }
                },
              }}
              edit={{ edit: false, remove: false }}
            />
          </FeatureGroup>
        )}
      </MapContainer>
    </div>
  );
};

export default FarmMap;
