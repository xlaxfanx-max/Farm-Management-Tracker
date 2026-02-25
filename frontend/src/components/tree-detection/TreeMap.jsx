import React, { useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Polygon, useMap } from 'react-leaflet';
import { RefreshCw, Trees } from 'lucide-react';
import HealthLegend from './HealthLegend';

const HEALTH_COLORS = {
  healthy: '#22c55e',
  moderate: '#eab308',
  stressed: '#f97316',
  critical: '#ef4444',
  unknown: '#9ca3af',
};

const DEFAULT_CENTER = [36.7, -119.8]; // California
const DEFAULT_ZOOM = 13;

/**
 * FitBounds - child component that auto-fits the map to the given bounds.
 */
const FitBounds = ({ bounds }) => {
  const map = useMap();

  useEffect(() => {
    if (bounds && bounds.length > 0) {
      try {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 18 });
      } catch (err) {
        console.warn('Failed to fit bounds:', err);
      }
    }
  }, [map, bounds]);

  return null;
};

const TreeMap = ({ trees = [], field, loading = false }) => {
  // Parse field boundary - swap [lng, lat] to [lat, lng] for Leaflet
  const boundaryPositions = useMemo(() => {
    if (!field?.boundary_geojson) return null;
    try {
      const geojson =
        typeof field.boundary_geojson === 'string'
          ? JSON.parse(field.boundary_geojson)
          : field.boundary_geojson;

      // Support GeoJSON Polygon or MultiPolygon
      let coords;
      if (geojson.type === 'Polygon') {
        coords = geojson.coordinates;
      } else if (geojson.type === 'MultiPolygon') {
        coords = geojson.coordinates[0]; // Use first polygon
      } else if (geojson.type === 'Feature') {
        if (geojson.geometry.type === 'Polygon') {
          coords = geojson.geometry.coordinates;
        } else if (geojson.geometry.type === 'MultiPolygon') {
          coords = geojson.geometry.coordinates[0];
        }
      } else {
        return null;
      }

      if (!coords || coords.length === 0) return null;

      // GeoJSON coords are [lng, lat], Leaflet needs [lat, lng]
      return coords.map((ring) =>
        ring.map(([lng, lat]) => [lat, lng])
      );
    } catch (err) {
      console.warn('Failed to parse boundary GeoJSON:', err);
      return null;
    }
  }, [field]);

  // Compute map bounds from boundary or tree locations
  const fitBounds = useMemo(() => {
    const points = [];

    // Add boundary points
    if (boundaryPositions) {
      boundaryPositions.forEach((ring) => {
        ring.forEach(([lat, lng]) => points.push([lat, lng]));
      });
    }

    // Add tree points
    if (trees.length > 0) {
      trees.forEach((tree) => {
        const lat = tree.latitude || tree.lat;
        const lng = tree.longitude || tree.lng || tree.lon;
        if (lat && lng) {
          points.push([lat, lng]);
        }
      });
    }

    return points.length > 0 ? points : null;
  }, [boundaryPositions, trees]);

  // Build health summary from tree data for the legend
  const healthCounts = useMemo(() => {
    const counts = {};
    trees.forEach((tree) => {
      const cat = tree.health_category || tree.health || 'unknown';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [trees]);

  const getTreeColor = (tree) => {
    const cat = tree.health_category || tree.health || 'unknown';
    return HEALTH_COLORS[cat] || HEALTH_COLORS.unknown;
  };

  const getTreeRadius = (tree) => {
    // Scale by canopy diameter if available, otherwise fixed size
    const diameter = tree.canopy_diameter || tree.crown_diameter;
    if (diameter) {
      return Math.max(3, Math.min(10, diameter / 2));
    }
    return 5;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-slate-50">
        <div className="text-center">
          <RefreshCw size={28} className="animate-spin text-slate-400 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Loading tree data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" style={{ height: '500px' }}>
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        className="h-full w-full z-0"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Auto-fit bounds */}
        {fitBounds && <FitBounds bounds={fitBounds} />}

        {/* Field Boundary */}
        {boundaryPositions &&
          boundaryPositions.map((ring, idx) => (
            <Polygon
              key={`boundary-${idx}`}
              positions={ring}
              pathOptions={{
                color: '#3b82f6',
                weight: 2,
                fillColor: '#3b82f6',
                fillOpacity: 0.05,
                dashArray: '6 4',
              }}
            />
          ))}

        {/* Tree Markers */}
        {trees.map((tree) => {
          const lat = tree.latitude || tree.lat;
          const lng = tree.longitude || tree.lng || tree.lon;
          if (!lat || !lng) return null;

          return (
            <CircleMarker
              key={tree.id || `${lat}-${lng}`}
              center={[lat, lng]}
              radius={getTreeRadius(tree)}
              pathOptions={{
                color: getTreeColor(tree),
                fillColor: getTreeColor(tree),
                fillOpacity: 0.7,
                weight: 1,
              }}
            >
              <Popup>
                <div className="min-w-[180px] text-sm">
                  <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-1">
                    <span
                      className="w-3 h-3 rounded-full inline-block"
                      style={{ backgroundColor: getTreeColor(tree) }}
                    />
                    Tree #{tree.id || '--'}
                  </h4>
                  <table className="w-full text-xs">
                    <tbody>
                      {tree.confidence != null && (
                        <PopupRow
                          label="Confidence"
                          value={`${(tree.confidence * 100).toFixed(1)}%`}
                        />
                      )}
                      {tree.confidence_score != null && tree.confidence == null && (
                        <PopupRow
                          label="Confidence"
                          value={`${(tree.confidence_score * 100).toFixed(1)}%`}
                        />
                      )}
                      {(tree.canopy_diameter || tree.crown_diameter) && (
                        <PopupRow
                          label="Canopy Diameter"
                          value={`${(tree.canopy_diameter || tree.crown_diameter).toFixed(1)} m`}
                        />
                      )}
                      {tree.ndvi != null && (
                        <PopupRow label="NDVI" value={tree.ndvi.toFixed(3)} />
                      )}
                      {tree.ndvi_value != null && tree.ndvi == null && (
                        <PopupRow label="NDVI" value={tree.ndvi_value.toFixed(3)} />
                      )}
                      {tree.ndvi_mean != null && (
                        <PopupRow label="NDVI Mean" value={tree.ndvi_mean.toFixed(3)} />
                      )}
                      {tree.ndvi_min != null && (
                        <PopupRow label="NDVI Min" value={tree.ndvi_min.toFixed(3)} />
                      )}
                      {tree.ndvi_max != null && (
                        <PopupRow label="NDVI Max" value={tree.ndvi_max.toFixed(3)} />
                      )}
                      <PopupRow
                        label="Health"
                        value={
                          <span
                            className="inline-flex items-center gap-1 font-medium capitalize"
                            style={{ color: getTreeColor(tree) }}
                          >
                            {tree.health_category || tree.health || 'Unknown'}
                          </span>
                        }
                      />
                    </tbody>
                  </table>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Health Legend Overlay */}
      <div className="absolute bottom-4 right-4 z-[1000]">
        <HealthLegend healthSummary={healthCounts} />
      </div>

      {/* Tree count badge */}
      {trees.length > 0 && (
        <div className="absolute top-4 left-4 z-[1000] bg-white rounded-lg shadow-md px-3 py-2 flex items-center gap-2">
          <Trees size={16} className="text-primary" />
          <span className="text-sm font-medium text-slate-700">
            {trees.length.toLocaleString()} trees
          </span>
        </div>
      )}
    </div>
  );
};

const PopupRow = ({ label, value }) => (
  <tr className="border-b border-slate-100 last:border-0">
    <td className="py-1 pr-2 text-slate-500 whitespace-nowrap">{label}</td>
    <td className="py-1 font-medium text-slate-800 text-right">{value}</td>
  </tr>
);

export default TreeMap;
