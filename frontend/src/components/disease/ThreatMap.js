import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, LayersControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, MapPin, Bug, Shield, Layers, RefreshCw } from 'lucide-react';
import { diseaseAPI } from '../../services/api';

// Fix Leaflet default marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons
const createIcon = (color, size = 24) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};

const hlbIcon = createIcon('#dc2626', 20); // Red for HLB
const acpIcon = createIcon('#f97316', 18); // Orange for ACP
const farmIcon = createIcon('#22c55e', 22); // Green for farms
const farmAtRiskIcon = createIcon('#eab308', 22); // Yellow for at-risk farms
const farmHighRiskIcon = createIcon('#ef4444', 22); // Red for high-risk farms

// Map bounds adjuster component
function MapBoundsAdjuster({ farms, detections }) {
  const map = useMap();

  useEffect(() => {
    const allPoints = [];

    // Add farm coordinates
    farms?.forEach(farm => {
      if (farm.gps_latitude && farm.gps_longitude) {
        allPoints.push([parseFloat(farm.gps_latitude), parseFloat(farm.gps_longitude)]);
      }
    });

    // Add detection coordinates
    detections?.forEach(detection => {
      if (detection.latitude && detection.longitude) {
        allPoints.push([parseFloat(detection.latitude), parseFloat(detection.longitude)]);
      }
    });

    // Fit bounds if we have points
    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    }
  }, [map, farms, detections]);

  return null;
}

// Detection marker layer
function DetectionLayer({ detections, type }) {
  const filteredDetections = detections?.filter(d => d.disease_type === type) || [];
  const icon = type === 'hlb' ? hlbIcon : acpIcon;
  const label = type === 'hlb' ? 'HLB' : 'ACP';

  return (
    <>
      {filteredDetections.map(detection => (
        <Marker
          key={`${type}-${detection.id}`}
          position={[parseFloat(detection.latitude), parseFloat(detection.longitude)]}
          icon={icon}
        >
          <Popup>
            <div className="text-sm">
              <div className="font-bold text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                {detection.disease_name || `${label} Detection`}
              </div>
              <div className="mt-2 space-y-1">
                <div><strong>Date:</strong> {detection.detection_date}</div>
                <div><strong>Location:</strong> {detection.city || detection.county}</div>
                <div><strong>Type:</strong> {detection.location_type}</div>
                {detection.county && <div><strong>County:</strong> {detection.county}</div>}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

// Farm marker layer
function FarmLayer({ farms }) {
  const getFarmIcon = (farm) => {
    const riskLevel = farm.predicted_risk_level || farm.risk_level;
    if (riskLevel === 'critical' || riskLevel === 'high') {
      return farmHighRiskIcon;
    } else if (riskLevel === 'moderate') {
      return farmAtRiskIcon;
    }
    return farmIcon;
  };

  return (
    <>
      {farms?.map(farm => {
        if (!farm.gps_latitude || !farm.gps_longitude) return null;

        return (
          <Marker
            key={`farm-${farm.id}`}
            position={[parseFloat(farm.gps_latitude), parseFloat(farm.gps_longitude)]}
            icon={getFarmIcon(farm)}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-bold text-green-700 flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {farm.name}
                </div>
                <div className="mt-2 space-y-1">
                  {farm.predicted_risk_score !== null && (
                    <div>
                      <strong>Risk Score:</strong>{' '}
                      <span className={
                        farm.predicted_risk_score >= 60 ? 'text-red-600' :
                        farm.predicted_risk_score >= 40 ? 'text-yellow-600' :
                        'text-green-600'
                      }>
                        {farm.predicted_risk_score}/100
                      </span>
                    </div>
                  )}
                  {farm.predicted_risk_level && (
                    <div>
                      <strong>Risk Level:</strong>{' '}
                      <span className={`capitalize ${
                        farm.predicted_risk_level === 'critical' ? 'text-red-600' :
                        farm.predicted_risk_level === 'high' ? 'text-orange-600' :
                        farm.predicted_risk_level === 'moderate' ? 'text-yellow-600' :
                        'text-green-600'
                      }`}>
                        {farm.predicted_risk_level}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

// Quarantine zone layer
function QuarantineZoneLayer({ zones }) {
  const getZoneStyle = (zone) => {
    const baseStyle = {
      weight: 2,
      opacity: 0.8,
      fillOpacity: 0.2,
    };

    switch (zone.zone_type) {
      case 'hlb':
        return { ...baseStyle, color: '#dc2626', fillColor: '#dc2626' };
      case 'acp':
        return { ...baseStyle, color: '#f97316', fillColor: '#f97316' };
      case 'eradication':
        return { ...baseStyle, color: '#7c3aed', fillColor: '#7c3aed' };
      default:
        return { ...baseStyle, color: '#6b7280', fillColor: '#6b7280' };
    }
  };

  return (
    <>
      {zones?.map(zone => {
        if (!zone.boundary || !zone.boundary.coordinates) return null;

        // Convert GeoJSON coordinates to Leaflet format
        const positions = zone.boundary.coordinates[0]?.map(coord => [coord[1], coord[0]]) || [];

        return (
          <Polygon
            key={`zone-${zone.id}`}
            positions={positions}
            pathOptions={getZoneStyle(zone)}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-bold flex items-center gap-1">
                  <Shield className="w-4 h-4" />
                  {zone.name}
                </div>
                <div className="mt-2 space-y-1">
                  <div><strong>Type:</strong> {zone.zone_type.toUpperCase()} Quarantine</div>
                  <div><strong>Established:</strong> {zone.established_date}</div>
                </div>
              </div>
            </Popup>
          </Polygon>
        );
      })}
    </>
  );
}

// Map Legend component
function MapLegend() {
  return (
    <div className="absolute bottom-4 left-4 bg-white p-3 rounded-lg shadow-lg z-[1000] text-xs">
      <div className="font-semibold mb-2 flex items-center gap-1">
        <Layers className="w-4 h-4" />
        Legend
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-600 border-2 border-white shadow"></div>
          <span>HLB Detection</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500 border-2 border-white shadow"></div>
          <span>ACP Activity</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white shadow"></div>
          <span>Your Farm (Low Risk)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500 border-2 border-white shadow"></div>
          <span>Your Farm (Moderate Risk)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow"></div>
          <span>Your Farm (High Risk)</span>
        </div>
        <hr className="my-1" />
        <div className="flex items-center gap-2">
          <div className="w-4 h-2 bg-red-600 opacity-30 border border-red-600"></div>
          <span>HLB Quarantine Zone</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-2 bg-orange-500 opacity-30 border border-orange-500"></div>
          <span>ACP Quarantine Zone</span>
        </div>
      </div>
    </div>
  );
}

/**
 * ThreatMap - Interactive map showing HLB/ACP detections, farms, and quarantine zones
 */
function ThreatMap({ className = '', height = '500px', showControls = true }) {
  const [mapData, setMapData] = useState({
    farms: [],
    detections: [],
    quarantine_zones: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [layerVisibility, setLayerVisibility] = useState({
    hlbDetections: true,
    acpActivity: true,
    farms: true,
    quarantineZones: true,
  });

  // California center coordinates
  const defaultCenter = [36.7783, -119.4179];
  const defaultZoom = 6;

  const fetchMapData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Try to fetch map data from API
      const response = await diseaseAPI.getMapData();
      setMapData(response.data);
    } catch (err) {
      console.error('Error fetching map data:', err);
      // If endpoint doesn't exist yet, use empty data
      if (err.response?.status === 404) {
        setMapData({
          farms: [],
          detections: [],
          quarantine_zones: [],
        });
      } else {
        setError('Failed to load map data');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMapData();
  }, [fetchMapData]);

  const toggleLayer = (layer) => {
    setLayerVisibility(prev => ({
      ...prev,
      [layer]: !prev[layer],
    }));
  };

  if (loading) {
    return (
      <div className={`bg-gray-100 rounded-lg flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-center text-gray-500">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>Loading threat map...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 rounded-lg flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-center text-red-600">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
          <p>{error}</p>
          <button
            onClick={fetchMapData}
            className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const hasData = mapData.farms?.length > 0 || mapData.detections?.length > 0;

  return (
    <div className={`relative ${className}`}>
      {/* Layer Controls */}
      {showControls && (
        <div className="absolute top-4 right-4 bg-white p-2 rounded-lg shadow-lg z-[1000] text-xs">
          <div className="font-semibold mb-2">Layers</div>
          <div className="space-y-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={layerVisibility.hlbDetections}
                onChange={() => toggleLayer('hlbDetections')}
                className="rounded"
              />
              <span>HLB Detections</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={layerVisibility.acpActivity}
                onChange={() => toggleLayer('acpActivity')}
                className="rounded"
              />
              <span>ACP Activity</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={layerVisibility.farms}
                onChange={() => toggleLayer('farms')}
                className="rounded"
              />
              <span>Your Farms</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={layerVisibility.quarantineZones}
                onChange={() => toggleLayer('quarantineZones')}
                className="rounded"
              />
              <span>Quarantine Zones</span>
            </label>
          </div>
          <button
            onClick={fetchMapData}
            className="mt-2 w-full px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs flex items-center justify-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>
      )}

      {/* Map Container */}
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height, width: '100%' }}
        className="rounded-lg"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Adjust bounds based on data */}
        {hasData && (
          <MapBoundsAdjuster farms={mapData.farms} detections={mapData.detections} />
        )}

        {/* HLB Detections Layer */}
        {layerVisibility.hlbDetections && (
          <DetectionLayer detections={mapData.detections} type="hlb" />
        )}

        {/* ACP Activity Layer */}
        {layerVisibility.acpActivity && (
          <DetectionLayer detections={mapData.detections} type="acp" />
        )}

        {/* Quarantine Zones Layer */}
        {layerVisibility.quarantineZones && (
          <QuarantineZoneLayer zones={mapData.quarantine_zones} />
        )}

        {/* Farms Layer */}
        {layerVisibility.farms && (
          <FarmLayer farms={mapData.farms} />
        )}

        {/* Legend */}
        <MapLegend />
      </MapContainer>

      {/* Empty State Overlay */}
      {!hasData && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white bg-opacity-90 p-4 rounded-lg text-center">
            <Bug className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600 text-sm">No detection data available yet</p>
            <p className="text-gray-400 text-xs mt-1">Add farms with GPS coordinates to see them on the map</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ThreatMap;
