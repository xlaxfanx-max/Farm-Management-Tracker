import React, { useState, useEffect } from 'react';
import {
  Cloud,
  Sun,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  Wind,
  Droplets,
  Thermometer,
  AlertCircle,
  RefreshCw,
  MapPin,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { weatherAPI, farmsAPI } from '../services/api';

// Weather icon mapping from OpenWeatherMap codes
const getWeatherIcon = (iconCode, size = 'w-8 h-8') => {
  const iconMap = {
    '01d': <Sun className={`${size} text-yellow-500`} />,
    '01n': <Sun className={`${size} text-yellow-400`} />,
    '02d': <Cloud className={`${size} text-gray-400`} />,
    '02n': <Cloud className={`${size} text-gray-400`} />,
    '03d': <Cloud className={`${size} text-gray-500`} />,
    '03n': <Cloud className={`${size} text-gray-500`} />,
    '04d': <Cloud className={`${size} text-gray-600`} />,
    '04n': <Cloud className={`${size} text-gray-600`} />,
    '09d': <CloudRain className={`${size} text-blue-500`} />,
    '09n': <CloudRain className={`${size} text-blue-500`} />,
    '10d': <CloudRain className={`${size} text-blue-400`} />,
    '10n': <CloudRain className={`${size} text-blue-400`} />,
    '11d': <CloudLightning className={`${size} text-yellow-600`} />,
    '11n': <CloudLightning className={`${size} text-yellow-600`} />,
    '13d': <CloudSnow className={`${size} text-blue-200`} />,
    '13n': <CloudSnow className={`${size} text-blue-200`} />,
    '50d': <CloudFog className={`${size} text-gray-400`} />,
    '50n': <CloudFog className={`${size} text-gray-400`} />,
  };
  return iconMap[iconCode] || <Cloud className={`${size} text-gray-400`} />;
};

// Spray rating badge component
const SprayRatingBadge = ({ rating, showLabel = true }) => {
  const config = {
    good: {
      icon: <CheckCircle className="w-4 h-4" />,
      bg: 'bg-green-100',
      text: 'text-primary',
      border: 'border-green-200',
      label: 'Good Spray Conditions',
    },
    fair: {
      icon: <AlertTriangle className="w-4 h-4" />,
      bg: 'bg-yellow-100',
      text: 'text-yellow-700',
      border: 'border-yellow-200',
      label: 'Fair Spray Conditions',
    },
    poor: {
      icon: <XCircle className="w-4 h-4" />,
      bg: 'bg-red-100',
      text: 'text-red-700',
      border: 'border-red-200',
      label: 'Poor Spray Conditions',
    },
  };

  const { icon, bg, text, border, label } = config[rating] || config.fair;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${bg} ${text} border ${border}`}>
      {icon}
      {showLabel && <span className="text-sm font-medium">{label}</span>}
    </div>
  );
};

export default function WeatherWidget({ onViewForecast }) {
  const [weather, setWeather] = useState(null);
  const [farms, setFarms] = useState([]);
  const [selectedFarm, setSelectedFarm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Load farms on mount
  useEffect(() => {
    const loadFarms = async () => {
      try {
        const response = await farmsAPI.getAll();
        const farmList = response.data.results || response.data || [];
        setFarms(farmList);

        // Select first farm with coordinates
        const farmWithCoords = farmList.find(f => f.gps_latitude && f.gps_longitude);
        if (farmWithCoords) {
          setSelectedFarm(farmWithCoords);
        } else if (farmList.length > 0) {
          setSelectedFarm(farmList[0]);
        }
      } catch (err) {
        console.error('Failed to load farms:', err);
        setError('Failed to load farms');
      }
    };

    loadFarms();
  }, []);

  // Load weather when farm changes
  useEffect(() => {
    if (!selectedFarm) {
      setLoading(false);
      return;
    }

    const loadWeather = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await weatherAPI.getCurrentWeather(selectedFarm.id);
        setWeather(response.data);
      } catch (err) {
        console.error('Failed to load weather:', err);
        if (err.response?.data?.needs_location) {
          setError('Farm needs GPS coordinates');
        } else if (err.response?.data?.needs_api_key) {
          setError('Weather API not configured');
        } else {
          setError('Failed to load weather');
        }
      } finally {
        setLoading(false);
      }
    };

    loadWeather();
  }, [selectedFarm]);

  const handleRefresh = async () => {
    if (!selectedFarm || refreshing) return;

    setRefreshing(true);
    try {
      const response = await weatherAPI.getCurrentWeather(selectedFarm.id);
      setWeather(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to refresh weather:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // No farms state
  if (farms.length === 0 && !loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Weather</h3>
        </div>
        <div className="text-center py-6 text-gray-500">
          <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>Add a farm to see weather data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Weather</h3>
        <div className="flex items-center gap-2">
          {farms.length > 1 && (
            <select
              value={selectedFarm?.id || ''}
              onChange={(e) => {
                const farm = farms.find(f => f.id === parseInt(e.target.value));
                setSelectedFarm(farm);
              }}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {farms.map(farm => (
                <option key={farm.id} value={farm.id}>{farm.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh weather"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-6 text-gray-500">
          <AlertCircle className="w-10 h-10 mb-2 text-gray-300" />
          <p className="text-sm">{error}</p>
          {error === 'Farm needs GPS coordinates' && (
            <p className="text-xs mt-1">Set coordinates in farm settings</p>
          )}
        </div>
      )}

      {/* Weather content */}
      {weather && !loading && !error && (
        <div className="space-y-4">
          {/* Current conditions */}
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              {getWeatherIcon(weather.icon, 'w-16 h-16')}
            </div>
            <div className="flex-1">
              <div className="text-4xl font-bold text-gray-900">
                {weather.temperature}°F
              </div>
              <div className="text-gray-600">{weather.conditions}</div>
              {weather.feels_like !== weather.temperature && (
                <div className="text-sm text-gray-500">
                  Feels like {weather.feels_like}°F
                </div>
              )}
            </div>
          </div>

          {/* Weather details */}
          <div className="grid grid-cols-3 gap-3 py-3 border-t border-b border-gray-100">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                <Wind className="w-4 h-4" />
              </div>
              <div className="text-sm font-medium text-gray-900">
                {weather.wind_speed} mph
              </div>
              <div className="text-xs text-gray-500">{weather.wind_direction}</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                <Droplets className="w-4 h-4" />
              </div>
              <div className="text-sm font-medium text-gray-900">
                {weather.humidity}%
              </div>
              <div className="text-xs text-gray-500">Humidity</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                <Thermometer className="w-4 h-4" />
              </div>
              <div className="text-sm font-medium text-gray-900">
                {weather.dewpoint}°F
              </div>
              <div className="text-xs text-gray-500">Dewpoint</div>
            </div>
          </div>

          {/* Spray conditions */}
          {weather.spray_conditions && (
            <div className="pt-2">
              <SprayRatingBadge rating={weather.spray_conditions.rating} />
              <div className="mt-2 text-sm text-gray-600">
                Score: {weather.spray_conditions.score}/100
              </div>
            </div>
          )}

          {/* View forecast link */}
          {onViewForecast && (
            <button
              onClick={() => onViewForecast(selectedFarm)}
              className="w-full text-center text-sm text-primary hover:text-primary-hover font-medium mt-2"
            >
              View Full Forecast →
            </button>
          )}

          {/* Cache indicator */}
          {weather.cached && (
            <div className="text-xs text-gray-400 text-center">
              {weather.stale ? 'Cached (offline)' : 'Cached'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Export helper components for reuse
export { getWeatherIcon, SprayRatingBadge };
