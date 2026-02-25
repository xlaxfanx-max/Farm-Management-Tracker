import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { X, Check, MapPin, Navigation, Edit3, AlertCircle, RefreshCw } from 'lucide-react';
import { useConfirm } from '../contexts/ConfirmContext';
import { useToast } from '../contexts/ToastContext';

// Custom marker icon
const createMarkerIcon = (color = '#16a34a') => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 32px;
      height: 32px;
      background: ${color};
      border: 3px solid white;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    "><div style="
      width: 10px;
      height: 10px;
      background: white;
      border-radius: 50%;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    "></div></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
};

// Component to handle map click and drag marker
function DraggableMarker({ position, onPositionChange }) {
  const markerRef = useRef(null);
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.setView(position, map.getZoom());
    }
  }, [position, map]);

  useMapEvents({
    click(e) {
      onPositionChange([e.latlng.lat, e.latlng.lng]);
    },
  });

  if (!position) return null;

  return (
    <Marker
      position={position}
      icon={createMarkerIcon('#16a34a')}
      draggable={true}
      ref={markerRef}
      eventHandlers={{
        dragend() {
          const marker = markerRef.current;
          if (marker != null) {
            const latlng = marker.getLatLng();
            onPositionChange([latlng.lat, latlng.lng]);
          }
        },
      }}
    />
  );
}

// Component to show alternative markers
function AlternativeMarkers({ alternatives, onSelect }) {
  return alternatives.map((alt, idx) => (
    <Marker
      key={idx}
      position={[alt.lat, alt.lng]}
      icon={createMarkerIcon('#6b7280')}
      eventHandlers={{
        click: () => onSelect(alt),
      }}
    />
  ));
}

/**
 * GeocodePreviewModal - Shows geocoding results with map preview
 * Allows user to verify/adjust location before saving
 */
function GeocodePreviewModal({
  isOpen,
  onClose,
  onConfirm,
  farmName,
  initialResult,
  isLoading,
  error,
  onRetry
}) {
  const confirmDialog = useConfirm();
  const toast = useToast();
  const [position, setPosition] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [alternatives, setAlternatives] = useState([]);
  const [manualMode, setManualMode] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');

  // Update state when initialResult changes
  useEffect(() => {
    if (initialResult) {
      setPosition([initialResult.lat, initialResult.lng]);
      setDisplayName(initialResult.display_name || '');
      setAlternatives(initialResult.alternatives || []);
      setManualLat(initialResult.lat.toFixed(6));
      setManualLng(initialResult.lng.toFixed(6));
    }
  }, [initialResult]);

  // Update manual inputs when position changes from map
  useEffect(() => {
    if (position && !manualMode) {
      setManualLat(position[0].toFixed(6));
      setManualLng(position[1].toFixed(6));
    }
  }, [position, manualMode]);

  const handleManualSubmit = async () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);

    if (isNaN(lat) || isNaN(lng)) {
      toast.error('Please enter valid coordinates');
      return;
    }

    // Basic validation for California bounds
    if (lat < 32 || lat > 42 || lng < -124.5 || lng > -114) {
      const ok = await confirmDialog({ title: 'Are you sure?', message: 'These coordinates appear to be outside California. Continue anyway?', confirmLabel: 'Continue', variant: 'warning' });
      if (!ok) return;
    }

    setPosition([lat, lng]);
    setManualMode(false);
  };

  const handleSelectAlternative = (alt) => {
    setPosition([alt.lat, alt.lng]);
    setDisplayName(alt.display_name);
  };

  const handleConfirm = () => {
    if (position) {
      onConfirm({
        lat: position[0],
        lng: position[1],
        display_name: displayName
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Verify Farm Location
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">{farmName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-primary animate-spin mb-3" />
              <p className="text-gray-600">Finding location...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">Location Not Found</h4>
              <p className="text-gray-600 mb-4 max-w-md mx-auto">
                {error.suggestion || 'Could not find coordinates for this address.'}
              </p>

              {/* Show manual entry option */}
              <div className="bg-gray-50 rounded-lg p-4 max-w-sm mx-auto">
                <p className="text-sm font-medium text-gray-700 mb-3">Enter coordinates manually:</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Latitude</label>
                    <input
                      type="text"
                      value={manualLat}
                      onChange={(e) => setManualLat(e.target.value)}
                      placeholder="36.7378"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Longitude</label>
                    <input
                      type="text"
                      value={manualLng}
                      onChange={(e) => setManualLng(e.target.value)}
                      placeholder="-119.7871"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
                <button
                  onClick={() => {
                    const lat = parseFloat(manualLat);
                    const lng = parseFloat(manualLng);
                    if (!isNaN(lat) && !isNaN(lng)) {
                      setPosition([lat, lng]);
                      setDisplayName('Manual coordinates');
                    }
                  }}
                  className="mt-3 w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover text-sm font-medium transition-colors"
                >
                  Set Location
                </button>
              </div>

              {onRetry && (
                <button
                  onClick={onRetry}
                  className="mt-4 text-primary hover:text-primary-hover text-sm font-medium"
                >
                  Try again with different address
                </button>
              )}
            </div>
          ) : position ? (
            <>
              {/* Found location info */}
              <div className="mb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Found:</span> {displayName}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Coordinates: {position[0].toFixed(6)}, {position[1].toFixed(6)}
                    </p>
                  </div>
                  <button
                    onClick={() => setManualMode(!manualMode)}
                    className="ml-4 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Edit3 className="w-4 h-4" />
                    {manualMode ? 'Use Map' : 'Edit'}
                  </button>
                </div>

                {/* Manual coordinate entry */}
                {manualMode && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Latitude</label>
                        <input
                          type="text"
                          value={manualLat}
                          onChange={(e) => setManualLat(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Longitude</label>
                        <input
                          type="text"
                          value={manualLng}
                          onChange={(e) => setManualLng(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleManualSubmit}
                      className="mt-2 w-full px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium transition-colors"
                    >
                      Apply Coordinates
                    </button>
                  </div>
                )}
              </div>

              {/* Map Preview */}
              <div className="relative rounded-lg overflow-hidden border border-gray-200" style={{ height: '300px' }}>
                <MapContainer
                  center={position}
                  zoom={15}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    attribution='&copy; Esri'
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  />
                  <DraggableMarker
                    position={position}
                    onPositionChange={setPosition}
                  />
                  {alternatives.length > 0 && (
                    <AlternativeMarkers
                      alternatives={alternatives}
                      onSelect={handleSelectAlternative}
                    />
                  )}
                </MapContainer>

                {/* Map instructions overlay */}
                <div className="absolute bottom-2 left-2 right-2 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-gray-600">
                  <Navigation className="w-3 h-3 inline mr-1" />
                  Click or drag the marker to adjust the location
                  {alternatives.length > 0 && (
                    <span className="ml-2">• Gray markers show alternative locations</span>
                  )}
                </div>
              </div>

              {/* Alternatives list */}
              {alternatives.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Alternative Locations
                  </p>
                  <div className="space-y-1">
                    {alternatives.map((alt, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectAlternative(alt)}
                        className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors truncate"
                      >
                        {alt.display_name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!position || isLoading}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
}

export default GeocodePreviewModal;
