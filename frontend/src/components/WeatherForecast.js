import React, { useState, useEffect } from 'react';
import {
  Cloud,
  Sun,
  Wind,
  Droplets,
  Thermometer,
  AlertCircle,
  RefreshCw,
  MapPin,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  Calendar,
} from 'lucide-react';
import { weatherAPI, farmsAPI } from '../services/api';
import { getWeatherIcon, SprayRatingBadge } from './WeatherWidget';

// Factor status indicator
const FactorStatus = ({ status, value, message }) => {
  const config = {
    good: { icon: <CheckCircle className="w-4 h-4" />, color: 'text-primary', bg: 'bg-green-50' },
    fair: { icon: <AlertTriangle className="w-4 h-4" />, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    poor: { icon: <XCircle className="w-4 h-4" />, color: 'text-danger', bg: 'bg-danger-bg' },
  };

  const { icon, color, bg } = config[status] || config.fair;

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg ${bg}`}>
      <div className={color}>{icon}</div>
      <div className="flex-1">
        <div className={`font-medium ${color}`}>{message}</div>
        <div className="text-sm text-bark-600">Current: {value}</div>
      </div>
    </div>
  );
};

// Daily forecast card
const DayForecastCard = ({ day, isToday }) => {
  const date = new Date(day.date);
  const dayName = isToday ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' });
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className={`bg-surface-raised rounded-lg border ${isToday ? 'border-green-200 ring-2 ring-green-100' : 'border-border'} p-4 text-center`}>
      <div className="font-medium text-heading">{dayName}</div>
      <div className="text-xs text-text-secondary mb-2">{dateStr}</div>

      <div className="flex justify-center my-3">
        {getWeatherIcon(day.icon, 'w-10 h-10')}
      </div>

      <div className="text-lg font-bold text-heading">{day.high}°</div>
      <div className="text-sm text-text-secondary">{day.low}°</div>

      <div className="mt-3 pt-3 border-t border-border">
        <div className="text-xs text-bark-600 mb-2">{day.conditions}</div>

        <div className="flex justify-center gap-3 text-xs text-text-secondary">
          <span className="flex items-center gap-1">
            <Wind className="w-3 h-3" />
            {day.wind_speed}
          </span>
          <span className="flex items-center gap-1">
            <Droplets className="w-3 h-3" />
            {day.humidity}%
          </span>
        </div>

        {day.rain_chance > 0 && (
          <div className="mt-2 text-xs text-link">
            {day.rain_chance}% rain
          </div>
        )}

        <div className="mt-2">
          <SprayRatingBadge rating={day.spray_rating} showLabel={false} />
        </div>
      </div>
    </div>
  );
};

export default function WeatherForecast() {
  const [farms, setFarms] = useState([]);
  const [selectedFarm, setSelectedFarm] = useState(null);
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [thresholds, setThresholds] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showThresholds, setShowThresholds] = useState(false);

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
        setLoading(false);
      }
    };

    loadFarms();
  }, []);

  // Load weather and forecast when farm changes
  useEffect(() => {
    if (!selectedFarm) {
      setLoading(false);
      return;
    }

    const loadWeatherData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [weatherRes, forecastRes, thresholdsRes] = await Promise.all([
          weatherAPI.getCurrentWeather(selectedFarm.id),
          weatherAPI.getForecast(selectedFarm.id),
          weatherAPI.getThresholds(),
        ]);

        setWeather(weatherRes.data);
        setForecast(forecastRes.data);
        setThresholds(thresholdsRes.data);
      } catch (err) {
        console.error('Failed to load weather data:', err);
        if (err.response?.data?.needs_location) {
          setError('This farm needs GPS coordinates to display weather data.');
        } else if (err.response?.data?.needs_api_key) {
          setError('Weather API key not configured. Add OPENWEATHERMAP_API_KEY to your .env file.');
        } else {
          setError('Failed to load weather data. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };

    loadWeatherData();
  }, [selectedFarm]);

  const handleRefresh = async () => {
    if (!selectedFarm) return;

    setLoading(true);
    try {
      const [weatherRes, forecastRes] = await Promise.all([
        weatherAPI.getCurrentWeather(selectedFarm.id),
        weatherAPI.getForecast(selectedFarm.id),
      ]);
      setWeather(weatherRes.data);
      setForecast(forecastRes.data);
      setError(null);
    } catch (err) {
      console.error('Failed to refresh weather:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-bark-600">Real-time weather and spray condition assessment</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Farm selector */}
          {farms.length > 0 && (
            <select
              value={selectedFarm?.id || ''}
              onChange={(e) => {
                const farm = farms.find(f => f.id === parseInt(e.target.value));
                setSelectedFarm(farm);
              }}
              className="px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
            >
              {farms.map(farm => (
                <option key={farm.id} value={farm.id}>
                  {farm.name}
                  {!farm.gps_latitude && ' (no coordinates)'}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-bark-600">Loading weather data...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="bg-danger-bg border border-danger/25 rounded-card p-6 text-center">
          <AlertCircle className="w-12 h-12 text-danger mx-auto mb-3" />
          <h3 className="text-lg text-danger mb-2">Unable to Load Weather</h3>
          <p className="text-danger">{error}</p>
        </div>
      )}

      {/* No farms state */}
      {farms.length === 0 && !loading && !error && (
        <div className="bg-cream-50 border border-border rounded-card p-8 text-center">
          <MapPin className="w-16 h-16 text-sand-300 mx-auto mb-4" />
          <h3 className="text-lg text-heading mb-2">No Farms Found</h3>
          <p className="text-bark-600">Add a farm with GPS coordinates to view weather data.</p>
        </div>
      )}

      {/* Weather content */}
      {weather && forecast && !loading && !error && (
        <div className="space-y-6">
          {/* Current conditions and spray assessment */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Current Weather Card */}
            <div className="bg-surface-raised rounded-card shadow-sm border border-border p-6">
              <h2 className="text-lg text-heading mb-4 flex items-center gap-2">
                <Sun className="w-5 h-5 text-yellow-600" />
                Current Conditions
              </h2>

              <div className="flex items-center gap-6 mb-6">
                <div className="flex-shrink-0">
                  {getWeatherIcon(weather.icon, 'w-20 h-20')}
                </div>
                <div>
                  <div className="text-5xl font-bold text-heading">
                    {weather.temperature}°F
                  </div>
                  <div className="text-xl text-bark-600">{weather.conditions}</div>
                  {weather.feels_like !== weather.temperature && (
                    <div className="text-text-secondary">Feels like {weather.feels_like}°F</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-border">
                <div className="text-center">
                  <Wind className="w-5 h-5 mx-auto text-text-muted mb-1" />
                  <div className="text-lg font-medium text-heading">{weather.wind_speed} mph</div>
                  <div className="text-xs text-text-secondary">{weather.wind_direction} Wind</div>
                </div>
                <div className="text-center">
                  <Droplets className="w-5 h-5 mx-auto text-text-muted mb-1" />
                  <div className="text-lg font-medium text-heading">{weather.humidity}%</div>
                  <div className="text-xs text-text-secondary">Humidity</div>
                </div>
                <div className="text-center">
                  <Thermometer className="w-5 h-5 mx-auto text-text-muted mb-1" />
                  <div className="text-lg font-medium text-heading">{weather.dewpoint}°F</div>
                  <div className="text-xs text-text-secondary">Dewpoint</div>
                </div>
                <div className="text-center">
                  <Cloud className="w-5 h-5 mx-auto text-text-muted mb-1" />
                  <div className="text-lg font-medium text-heading">{weather.clouds}%</div>
                  <div className="text-xs text-text-secondary">Cloud Cover</div>
                </div>
              </div>

              {weather.cached && (
                <div className="mt-4 text-xs text-text-muted text-center">
                  {weather.stale ? 'Cached data (API unavailable)' : 'Cached'}
                </div>
              )}
            </div>

            {/* Spray Conditions Card */}
            {weather.spray_conditions && (
              <div className="bg-surface-raised rounded-card shadow-sm border border-border p-6">
                <h2 className="text-lg text-heading mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-text-muted" />
                  Spray Conditions Assessment
                </h2>

                <div className="flex items-center justify-between mb-6">
                  <SprayRatingBadge rating={weather.spray_conditions.rating} />
                  <div className="text-right">
                    <div className="text-3xl font-bold text-heading">
                      {weather.spray_conditions.score}
                    </div>
                    <div className="text-sm text-text-secondary">out of 100</div>
                  </div>
                </div>

                <div className="space-y-3">
                  {weather.spray_conditions.factors && Object.entries(weather.spray_conditions.factors).map(([key, factor]) => (
                    <FactorStatus
                      key={key}
                      status={factor.status}
                      value={typeof factor.value === 'number' ? `${factor.value}${key === 'humidity' ? '%' : key === 'wind' ? ' mph' : key === 'temperature' ? '°F' : ''}` : factor.value}
                      message={factor.message}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 7-Day Forecast */}
          <div className="bg-surface-raised rounded-card shadow-sm border border-border p-6">
            <h2 className="text-lg text-heading mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-text-muted" />
              7-Day Forecast
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {forecast.daily?.map((day, index) => (
                <DayForecastCard key={day.date} day={day} isToday={index === 0} />
              ))}
            </div>

            {forecast.cached && (
              <div className="mt-4 text-xs text-text-muted text-center">
                {forecast.stale ? 'Cached forecast (API unavailable)' : 'Cached'}
              </div>
            )}
          </div>

          {/* Threshold Reference */}
          {thresholds && (
            <div className="bg-surface-raised rounded-card shadow-sm border border-border">
              <button
                onClick={() => setShowThresholds(!showThresholds)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-text-muted" />
                  <span className="font-medium text-heading">Spray Condition Thresholds</span>
                </div>
                {showThresholds ? (
                  <ChevronDown className="w-5 h-5 text-text-muted" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-text-muted" />
                )}
              </button>

              {showThresholds && (
                <div className="px-4 pb-4 border-t border-border">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                    {thresholds.descriptions && Object.entries(thresholds.descriptions).map(([key, desc]) => (
                      <div key={key} className="bg-cream-50 rounded-lg p-4">
                        <h4 className=" text-heading capitalize mb-2">{key}</h4>
                        <div className="space-y-1 text-sm">
                          {Object.entries(desc).map(([level, text]) => (
                            <div key={level} className="text-bark-600">
                              <span className="font-medium capitalize">{level}:</span> {text}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
