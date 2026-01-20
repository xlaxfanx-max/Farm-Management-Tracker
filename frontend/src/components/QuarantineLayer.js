import React, { useState, useEffect, useCallback } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import { quarantineAPI } from '../services/api';

/**
 * QuarantineLayer Component
 *
 * Renders HLB quarantine zone boundaries as semi-transparent polygons on the map.
 * Fetches GeoJSON data from the backend proxy endpoint.
 *
 * Props:
 *   visible - Whether the layer should be displayed (default: true)
 *   onLoad - Callback when boundaries are loaded
 *   onError - Callback when loading fails
 */
function QuarantineLayer({ visible = true, onLoad, onError }) {
  const [geojsonData, setGeojsonData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const map = useMap();

  // Fetch quarantine boundaries
  useEffect(() => {
    const fetchBoundaries = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await quarantineAPI.getBoundaries();
        setGeojsonData(response.data);
        if (onLoad) onLoad(response.data);
      } catch (err) {
        console.error('Error fetching quarantine boundaries:', err);
        const errorMsg = err.response?.data?.error || 'Failed to load quarantine boundaries';
        setError(errorMsg);
        if (onError) onError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    fetchBoundaries();
  }, [onLoad, onError]);

  // Style for quarantine zone polygons
  const quarantineStyle = useCallback((feature) => {
    return {
      fillColor: '#dc2626',
      fillOpacity: 0.2,
      color: '#dc2626',
      weight: 2,
      opacity: 0.8,
    };
  }, []);

  // Event handlers for each feature
  const onEachFeature = useCallback((feature, layer) => {
    // Hover effects
    layer.on({
      mouseover: (e) => {
        const layer = e.target;
        layer.setStyle({
          fillOpacity: 0.35,
          weight: 3,
        });
      },
      mouseout: (e) => {
        const layer = e.target;
        layer.setStyle({
          fillOpacity: 0.2,
          weight: 2,
        });
      },
    });

    // Build popup content from feature properties
    const props = feature.properties || {};

    // Try to extract name from various possible field names
    const zoneName = props.Name || props.QuarantineName || props.QUARANTINE_NAME ||
                     props.name || props.Pest || props.PEST || 'Unknown Quarantine Zone';

    // Try to extract and format effective date
    let effectiveDate = '';
    const dateValue = props.EffectiveDate || props.EFFECTIVE_DATE || props.effective_date;
    if (dateValue) {
      try {
        // CDFA often returns dates as Unix timestamps in milliseconds
        const date = typeof dateValue === 'number'
          ? new Date(dateValue)
          : new Date(dateValue);
        if (!isNaN(date.getTime())) {
          effectiveDate = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        }
      } catch (e) {
        // Ignore date parsing errors
      }
    }

    // Build popup HTML
    const popupContent = `
      <div style="min-width: 200px; font-family: system-ui, -apple-system, sans-serif;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <div style="width: 12px; height: 12px; background: #dc2626; border-radius: 2px;"></div>
          <strong style="color: #dc2626; font-size: 14px;">HLB Quarantine Zone</strong>
        </div>
        <div style="color: #374151; font-size: 13px; font-weight: 500; margin-bottom: 4px;">
          ${zoneName}
        </div>
        ${effectiveDate ? `
          <div style="color: #6b7280; font-size: 12px;">
            Effective: ${effectiveDate}
          </div>
        ` : ''}
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 11px;">
          Movement of citrus plant material is restricted within this zone.
        </div>
      </div>
    `;

    layer.bindPopup(popupContent);
  }, []);

  // Don't render if not visible or no data
  if (!visible || !geojsonData) {
    return null;
  }

  return (
    <GeoJSON
      key={JSON.stringify(geojsonData)} // Force re-render when data changes
      data={geojsonData}
      style={quarantineStyle}
      onEachFeature={onEachFeature}
    />
  );
}

export default QuarantineLayer;
