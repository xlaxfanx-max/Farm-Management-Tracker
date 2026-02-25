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
    poor: { icon: <XCircle className="w-4 h-4" />, color: 'text-red-600', bg: 'bg-red-50' },
  };

  const { icon, color, bg } = config[status] || config.fair;

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg ${bg}`}>
      <div className={color}>{icon}</div>
      <div className="flex-1">
        <div className={`font-medium ${color}`}>{message}</div>
        <div className="text-sm text-gray-600">Current: {value}</div>
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
    <div className={`bg-white rounded-lg border ${isToday ? 'border-green-200 ring-2 ring-green-100' : 'border-gray-200'} p-4 text-center`}>
      <div className="font-medium text-gray-900">{dayName}</div>
      <div className="text-xs text-gray-500 mb-2">{dateStr}</div>

      <div className="flex justify-center my-3">
        {getWeatherIcon(day.icon, 'w-10 h-10')}
      </div>

      <div className="text-lg font-bold text-gray-900">{day.high}°</div>
      <div className="text-sm text-gray-500">{day.low}°</div>

      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="text-xs text-gray-600 mb-2">{day.conditions}</div>

        <div className="flex justify-center gap-3 text-xs text-gray-500">
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
          <div className="mt-2 text-xs text-blue-600">
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
          <h1 className="text-2xl font-bold text-gray-900">Weather & Spray Forecast</h1>
          <p className="text-gray-600">Real-time weather and spray condition assessment</p>
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
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
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
            <p className="mt-4 text-gray-600">Loading weather data...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Unable to Load Weather</h3>
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* No farms state */}
      {farms.length === 0 && !loading && !error && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
          <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Farms Found</h3>
          <p className="text-gray-600">Add a farm with GPS coordinates to view weather data.</p>
        </div>
      )}

      {/* Weather content */}
      {weather && forecast && !loading && !error && (
        <div className="space-y-6">
          {/* Current conditions and spray assessment */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Current Weather Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Sun className="w-5 h-5 text-yellow-500" />
                Current Conditions
              </h2>

              <div className="flex items-center gap-6 mb-6">
                <div className="flex-shrink-0">
                  {getWeatherIcon(weather.icon, 'w-20 h-20')}
                </div>
                <div>
                  <div className="text-5xl font-bold text-gray-900">
                    {weather.temperature}°F
                  </div>
                  <div className="text-xl text-gray-600">{weather.conditions}</div>
                  {weather.feels_like !== weather.temperature && (
                    <div className="text-gray-500">Feels like {weather.feels_like}°F</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
                <div className="text-center">
                  <Wind className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                  <div className="text-lg font-medium text-gray-900">{weather.wind_speed} mph</div>
                  <div className="text-xs text-gray-500">{weather.wind_direction} Wind</div>
                </div>
                <div className="text-center">
                  <Droplets className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                  <div className="text-lg font-medium text-gray-900">{weather.humidity}%</div>
                  <div className="text-xs text-gray-500">Humidity</div>
                </div>
                <div className="text-center">
                  <Thermometer className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                  <div className="text-lg font-medium text-gray-900">{weather.dewpoint}°F</div>
                  <div className="text-xs text-gray-500">Dewpoint</div>
                </div>
                <div className="text-center">
                  <Cloud className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                  <div className="text-lg font-medium text-gray-900">{weather.clouds}%</div>
                  <div className="text-xs text-gray-500">Cloud Cover</div>
                </div>
              </div>

              {weather.cached && (
                <div className="mt-4 text-xs text-gray-400 text-center">
                  {weather.stale ? 'Cached data (API unavailable)' : 'Cached'}
                </div>
              )}
            </div>

            {/* Spray Conditions Card */}
            {weather.spray_conditions && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-gray-400" />
                  Spray Conditions Assessment
                </h2>

                <div className="flex items-center justify-between mb-6">
                  <SprayRatingBadge rating={weather.spray_conditions.rating} />
                  <div className="text-right">
                    <div className="text-3xl font-bold text-gray-900">
                      {weather.spray_conditions.score}
                    </div>
                    <div className="text-sm text-gray-500">out of 100</div>
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              7-Day Forecast
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {forecast.daily?.map((day, index) => (
                <DayForecastCard key={day.date} day={day} isToday={index === 0} />
              ))}
            </div>

            {forecast.cached && (
              <div className="mt-4 text-xs text-gray-400 text-center">
                {forecast.stale ? 'Cached forecast (API unavailable)' : 'Cached'}
              </div>
            )}
          </div>

          {/* Threshold Reference */}
          {thresholds && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <button
                onClick={() => setShowThresholds(!showThresholds)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-gray-400" />
                  <span className="font-medium text-gray-900">Spray Condition Thresholds</span>
                </div>
                {showThresholds ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {showThresholds && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                    {thresholds.descriptions && Object.entries(thresholds.descriptions).map(([key, desc]) => (
                      <div key={key} className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 capitalize mb-2">{key}</h4>
                        <div className="space-y-1 text-sm">
                          {Object.entries(desc).map(([level, text]) => (
                            <div key={level} className="text-gray-600">
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
