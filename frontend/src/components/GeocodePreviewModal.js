import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MAP_HEX } from '../theme/finchChartTheme';
import { Check, MapPin, Navigation, Edit3, AlertCircle, RefreshCw } from 'lucide-react';
import { useConfirm } from '../contexts/ConfirmContext';
import { useToast } from '../contexts/ToastContext';
import Modal from './ui/Modal';
import FormField, { inputClasses } from './ui/FormField';

const createMarkerIcon = (color = MAP_HEX.marker) =>
  L.divIcon({
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
      icon={createMarkerIcon(MAP_HEX.marker)}
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

function AlternativeMarkers({ alternatives, onSelect }) {
  return alternatives.map((alt, idx) => (
    <Marker
      key={idx}
      position={[alt.lat, alt.lng]}
      icon={createMarkerIcon(MAP_HEX.muted)}
      eventHandlers={{ click: () => onSelect(alt) }}
    />
  ));
}

function GeocodePreviewModal({
  isOpen,
  onClose,
  onConfirm,
  farmName,
  initialResult,
  isLoading,
  error,
  onRetry,
}) {
  const confirmDialog = useConfirm();
  const toast = useToast();
  const [position, setPosition] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [alternatives, setAlternatives] = useState([]);
  const [manualMode, setManualMode] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');

  useEffect(() => {
    if (initialResult) {
      setPosition([initialResult.lat, initialResult.lng]);
      setDisplayName(initialResult.display_name || '');
      setAlternatives(initialResult.alternatives || []);
      setManualLat(initialResult.lat.toFixed(6));
      setManualLng(initialResult.lng.toFixed(6));
    }
  }, [initialResult]);

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

    if (lat < 32 || lat > 42 || lng < -124.5 || lng > -114) {
      const ok = await confirmDialog({
        title: 'Are you sure?',
        message: 'These coordinates appear to be outside California. Continue anyway?',
        confirmLabel: 'Continue',
        variant: 'warning',
      });
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
        display_name: displayName,
      });
    }
  };

  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 rounded-button text-bark-700 hover:bg-cream-100 font-medium"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleConfirm}
        disabled={!position || isLoading}
        className="px-6 py-2 rounded-button bg-primary text-white hover:bg-primary-hover font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        <Check className="w-4 h-4" />
        Confirm Location
      </button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Verify Farm Location"
      subtitle={farmName}
      icon={MapPin}
      size="lg"
      footer={footer}
    >
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-primary animate-spin mb-3" />
          <p className="text-bark-600">Finding location…</p>
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
          <h4 className="text-lg font-medium text-heading mb-2">
            Location Not Found
          </h4>
          <p className="text-bark-600 mb-4 max-w-md mx-auto">
            {error.suggestion || 'Could not find coordinates for this address.'}
          </p>

          <div className="bg-cream-50 rounded-lg p-4 max-w-sm mx-auto">
            <p className="text-sm font-medium text-bark-700 mb-3">
              Enter coordinates manually:
            </p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Latitude" htmlFor="geo-err-lat">
                <input
                  id="geo-err-lat"
                  type="text"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                  placeholder="36.7378"
                  className={inputClasses}
                />
              </FormField>
              <FormField label="Longitude" htmlFor="geo-err-lng">
                <input
                  id="geo-err-lng"
                  type="text"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                  placeholder="-119.7871"
                  className={inputClasses}
                />
              </FormField>
            </div>
            <button
              type="button"
              onClick={() => {
                const lat = parseFloat(manualLat);
                const lng = parseFloat(manualLng);
                if (!isNaN(lat) && !isNaN(lng)) {
                  setPosition([lat, lng]);
                  setDisplayName('Manual coordinates');
                }
              }}
              className="mt-3 w-full px-4 py-2 rounded-button bg-primary text-white hover:bg-primary-hover text-sm font-medium"
            >
              Set Location
            </button>
          </div>

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 text-primary hover:text-primary-hover text-sm font-medium"
            >
              Try again with different address
            </button>
          )}
        </div>
      ) : position ? (
        <>
          <div className="mb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-bark-600">
                  <span className="font-medium text-text">Found:</span>{' '}
                  {displayName}
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  Coordinates: {position[0].toFixed(6)}, {position[1].toFixed(6)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManualMode(!manualMode)}
                className="px-3 py-1.5 text-sm text-bark-600 hover:text-text hover:bg-cream-100 rounded-lg flex items-center gap-1 flex-shrink-0"
              >
                <Edit3 className="w-4 h-4" />
                {manualMode ? 'Use Map' : 'Edit'}
              </button>
            </div>

            {manualMode && (
              <div className="mt-3 p-3 bg-cream-50 rounded-lg">
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Latitude" htmlFor="geo-lat">
                    <input
                      id="geo-lat"
                      type="text"
                      value={manualLat}
                      onChange={(e) => setManualLat(e.target.value)}
                      className={inputClasses}
                    />
                  </FormField>
                  <FormField label="Longitude" htmlFor="geo-lng">
                    <input
                      id="geo-lng"
                      type="text"
                      value={manualLng}
                      onChange={(e) => setManualLng(e.target.value)}
                      className={inputClasses}
                    />
                  </FormField>
                </div>
                <button
                  type="button"
                  onClick={handleManualSubmit}
                  className="mt-2 w-full px-3 py-1.5 rounded-button bg-sand-200 text-bark-700 hover:bg-sand-300 text-sm font-medium"
                >
                  Apply Coordinates
                </button>
              </div>
            )}
          </div>

          <div
            className="relative rounded-lg overflow-hidden border border-border"
            style={{ height: '300px' }}
          >
            <MapContainer
              center={position}
              zoom={15}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution="&copy; Esri"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
              <DraggableMarker position={position} onPositionChange={setPosition} />
              {alternatives.length > 0 && (
                <AlternativeMarkers
                  alternatives={alternatives}
                  onSelect={handleSelectAlternative}
                />
              )}
            </MapContainer>

            <div className="absolute bottom-2 left-2 right-2 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-bark-600">
              <Navigation className="w-3 h-3 inline mr-1" />
              Click or drag the marker to adjust the location
              {alternatives.length > 0 && (
                <span className="ml-2">• Gray markers show alternative locations</span>
              )}
            </div>
          </div>

          {alternatives.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
                Alternative Locations
              </p>
              <div className="space-y-1">
                {alternatives.map((alt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectAlternative(alt)}
                    className="w-full text-left px-3 py-2 text-sm text-bark-600 hover:bg-cream-50 rounded-lg truncate"
                  >
                    {alt.display_name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}
    </Modal>
  );
}

export default GeocodePreviewModal;
