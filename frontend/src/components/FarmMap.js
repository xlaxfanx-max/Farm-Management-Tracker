import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, FeatureGroup, LayersControl } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import { MapPin, Maximize2, Minimize2, Layers, Pencil, Save, X, Locate, AlertTriangle } from 'lucide-react';
import QuarantineLayer from './QuarantineLayer';

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
  const [showQuarantineLayer, setShowQuarantineLayer] = useState(true);
  const featureGroupRef = useRef(null);
  const mapRef = useRef(null);

  // Default center (Central California - Fresno area)
  const defaultCenter = [36.7378, -119.7871];
  const defaultZoom = 9;

  // Calculate center based on farms/fields with coordinates
  const getMapCenter = () => {
    const farmsWithCoords = farms.filter(f => f.gps_latitude && f.gps_longitude);
    const fieldsWithCoords = fields.filter(f => f.gps_latitude && f.gps_longitude);
    
    if (farmsWithCoords.length > 0) {
      const lat = farmsWithCoords.reduce((sum, f) => sum + parseFloat(f.gps_latitude), 0) / farmsWithCoords.length;
      const lng = farmsWithCoords.reduce((sum, f) => sum + parseFloat(f.gps_longitude), 0) / farmsWithCoords.length;
      return [lat, lng];
    }
    if (fieldsWithCoords.length > 0) {
      const lat = fieldsWithCoords.reduce((sum, f) => sum + parseFloat(f.gps_latitude), 0) / fieldsWithCoords.length;
      const lng = fieldsWithCoords.reduce((sum, f) => sum + parseFloat(f.gps_longitude), 0) / fieldsWithCoords.length;
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

  // Track when map is ready for useEffect dependencies
  const [mapReady, setMapReady] = useState(false);

  // Fix for map not rendering correctly when container size changes or becomes visible
  // This handles tabs, modals, or any situation where the map container isn't visible on initial render
  useEffect(() => {
    if (mapRef.current) {
      // Invalidate size after a short delay to ensure container has proper dimensions
      const timer = setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isExpanded, height, mapReady]);

  // Use ResizeObserver and IntersectionObserver to handle container resize and visibility
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const mapContainer = mapRef.current.getContainer();
    if (!mapContainer) return;

    // ResizeObserver for container size changes
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    });
    resizeObserver.observe(mapContainer);

    // IntersectionObserver for visibility changes (e.g., tab switching)
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && mapRef.current) {
            // Map became visible - invalidate size
            setTimeout(() => {
              if (mapRef.current) {
                mapRef.current.invalidateSize();
              }
            }, 100);
          }
        });
      },
      { threshold: 0.1 }
    );
    intersectionObserver.observe(mapContainer);

    // Also invalidate on window resize
    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [mapReady]);

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
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-2">
              <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase">Base Map</div>
              {Object.keys(tileLayers).map((type) => (
                <button
                  key={type}
                  onClick={() => { setMapType(type); }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${
                    mapType === type ? 'text-primary font-medium' : 'text-gray-700'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                  {mapType === type && <span className="text-green-500">✓</span>}
                </button>
              ))}
              <div className="border-t border-gray-100 mt-2 pt-2">
                <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase">Overlays</div>
                <button
                  onClick={() => setShowQuarantineLayer(!showQuarantineLayer)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${
                    showQuarantineLayer ? 'text-red-600 font-medium' : 'text-gray-700'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    HLB Quarantine
                  </span>
                  {showQuarantineLayer && <span className="text-red-500">✓</span>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Drawing Controls - positioned at bottom-left to avoid Leaflet controls */}
      {isDrawing && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-white rounded-lg shadow-xl border-2 border-blue-400 p-4 max-w-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-100 rounded-lg">
                <Pencil className="w-5 h-5 text-blue-600" />
              </div>
              <span className="font-semibold text-gray-800">Drawing: {drawingFieldName}</span>
            </div>
            <button
              onClick={cancelDrawing}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {!pendingBoundary && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
              <p className="text-sm text-blue-800 font-medium mb-1">
                <span className="inline-block w-5 h-5 bg-blue-600 text-white text-xs rounded mr-2 text-center leading-5">1</span>
                Click the polygon tool in the top-left corner
              </p>
              <p className="text-sm text-blue-800 font-medium mb-1">
                <span className="inline-block w-5 h-5 bg-blue-600 text-white text-xs rounded mr-2 text-center leading-5">2</span>
                Click on the map to place boundary points
              </p>
              <p className="text-sm text-blue-800 font-medium">
                <span className="inline-block w-5 h-5 bg-blue-600 text-white text-xs rounded mr-2 text-center leading-5">3</span>
                Click the first point to close the polygon
              </p>
            </div>
          )}

          {pendingBoundary && (
            <div className="bg-primary-light border border-green-200 rounded-lg p-3 mb-3">
              <div className="text-sm font-medium text-green-800">Boundary Drawn!</div>
              <div className="text-sm text-primary">
                Calculated area: <strong>{pendingBoundary.acres} acres</strong>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {pendingBoundary && (
              <button
                onClick={saveBoundary}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover text-sm font-semibold shadow-md"
              >
                <Save className="w-4 h-4" />
                Save Boundary
              </button>
            )}
            <button
              onClick={cancelDrawing}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium border border-red-200"
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
              <div className="w-3 h-3 rounded-full bg-primary"></div>
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
            {showQuarantineLayer && (
              <div className="flex items-center gap-2 text-xs pt-1 border-t border-gray-200 mt-1">
                <div className="w-3 h-3 rounded bg-red-600 opacity-40 border border-red-600"></div>
                <span className="text-red-700">HLB Quarantine Zone</span>
              </div>
            )}
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
          setMapReady(true);
          // Invalidate size after map is ready to fix grey areas
          // Use multiple delays to handle various rendering scenarios
          setTimeout(() => mapInstance.target.invalidateSize(), 0);
          setTimeout(() => mapInstance.target.invalidateSize(), 100);
          setTimeout(() => mapInstance.target.invalidateSize(), 300);
        }}
      >
        <TileLayer
          url={tileLayers[mapType].url}
          attribution={tileLayers[mapType].attribution}
          maxZoom={19}
        />

        {/* Quarantine Zone Overlay - rendered below farms/fields */}
        <QuarantineLayer visible={showQuarantineLayer} />

        {/* Farm Markers */}
        {farms.map((farm) => {
          if (!farm.gps_latitude || !farm.gps_longitude) return null;
          const farmFields = fields.filter(f => parseInt(f.farm) === farm.id);
          return (
            <Marker
              key={`farm-${farm.id}`}
              position={[parseFloat(farm.gps_latitude), parseFloat(farm.gps_longitude)]}
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
                              className={`ml-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                                field.boundary_geojson
                                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-300'
                                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg animate-pulse hover:animate-none'
                              }`}
                            >
                              <Pencil className="w-3 h-3" />
                              {field.boundary_geojson ? 'Redraw' : 'Draw Boundary'}
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
                <div className="min-w-[220px]">
                  <h3 className="font-bold text-lg text-gray-800">{field.name}</h3>
                  <p className="text-sm text-gray-600">{field.current_crop || 'No crop'}</p>
                  <p className="text-sm text-gray-500">{field.total_acres} acres</p>
                  <button
                    onClick={() => startDrawing(field.id, field.name)}
                    className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-semibold shadow-md hover:shadow-lg transition-all border border-amber-600"
                  >
                    <Pencil className="w-4 h-4" />
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
          if (!field.gps_latitude || !field.gps_longitude) return null;
          
          const colors = getFieldColor(field.current_crop);
          return (
            <Marker
              key={`field-${field.id}`}
              position={[parseFloat(field.gps_latitude), parseFloat(field.gps_longitude)]}
              icon={createFieldIcon(colors.fill)}
              eventHandlers={{
                click: () => onFieldSelect && onFieldSelect(field.id)
              }}
            >
              <Popup>
                <div className="min-w-[220px]">
                  <h3 className="font-bold text-lg text-gray-800">{field.name}</h3>
                  <p className="text-sm text-gray-600">{field.current_crop || 'No crop'}</p>
                  <p className="text-sm text-gray-500">{field.total_acres} acres</p>
                  <button
                    onClick={() => startDrawing(field.id, field.name)}
                    className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold shadow-md hover:shadow-lg transition-all animate-pulse hover:animate-none"
                  >
                    <Pencil className="w-4 h-4" />
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
