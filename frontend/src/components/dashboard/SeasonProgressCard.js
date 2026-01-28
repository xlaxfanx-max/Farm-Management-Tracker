/**
 * SeasonProgressCard Component
 *
 * Displays season progress for multiple crop categories, allowing farmers
 * with diversified operations to track each crop type's progress independently.
 */

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Package,
  FileText,
  DollarSign,
  AlertTriangle,
  Clock,
  ChevronRight,
  Citrus,
  Cherry,
  Grape,
  Leaf,
  Wheat,
} from 'lucide-react';
import { analyticsAPI } from '../../services/api';

// Category icon mapping
const categoryIcons = {
  citrus: Citrus,
  subtropical: Leaf,
  deciduous_fruit: Cherry,
  vine: Grape,
  nut: Leaf,
  berry: Cherry,
  row_crop: Wheat,
  vegetable: Leaf,
  other: Leaf,
};

// Category colors
const categoryColors = {
  citrus: { bg: 'from-orange-400 to-yellow-500', light: 'bg-orange-50', text: 'text-orange-600' },
  subtropical: { bg: 'from-green-500 to-emerald-600', light: 'bg-green-50', text: 'text-green-600' },
  deciduous_fruit: { bg: 'from-pink-400 to-rose-500', light: 'bg-pink-50', text: 'text-pink-600' },
  vine: { bg: 'from-purple-400 to-violet-500', light: 'bg-purple-50', text: 'text-purple-600' },
  nut: { bg: 'from-amber-500 to-yellow-600', light: 'bg-amber-50', text: 'text-amber-600' },
  berry: { bg: 'from-red-400 to-rose-500', light: 'bg-red-50', text: 'text-red-600' },
  row_crop: { bg: 'from-lime-500 to-green-600', light: 'bg-lime-50', text: 'text-lime-600' },
  vegetable: { bg: 'from-emerald-400 to-teal-500', light: 'bg-emerald-50', text: 'text-emerald-600' },
  other: { bg: 'from-gray-400 to-slate-500', light: 'bg-gray-50', text: 'text-gray-600' },
};

// Single crop category mini-card
const CropSeasonMiniCard = ({ data, onNavigate }) => {
  const Icon = categoryIcons[data.category] || Leaf;
  const colors = categoryColors[data.category] || categoryColors.other;
  const { season, current, last_season } = data;

  // Calculate comparison percentage
  const getComparisonPercent = (curr, prev) => {
    if (!prev || prev === 0) return null;
    return Math.round(((curr - prev) / prev) * 100);
  };

  const binsComparison = last_season
    ? getComparisonPercent(current.harvest_bins, last_season.harvest_bins)
    : null;

  // Format number
  const formatNumber = (value) => {
    if (!value) return '0';
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString();
  };

  // Format currency
  const formatCurrency = (value) => {
    if (!value) return '$0';
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  // Format date range
  const formatDateRange = () => {
    if (!season.start_date || !season.end_date) return '';
    const start = new Date(season.start_date + 'T00:00:00');
    const end = new Date(season.end_date + 'T00:00:00');
    const opts = { month: 'short', day: 'numeric' };
    return `${start.toLocaleDateString('en-US', opts)} - ${end.toLocaleDateString('en-US', opts)}`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <div className={`px-4 py-3 ${colors.light} dark:bg-gray-700/50`}>
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 bg-gradient-to-br ${colors.bg} rounded-full flex items-center justify-center`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
              {data.category_display}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {season.label} • {data.field_count} field{data.field_count !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
          <span>{formatDateRange()}</span>
          <span>{season.progress_percent}%</span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${colors.bg} rounded-full transition-all duration-500`}
            style={{ width: `${season.progress_percent}%` }}
          />
        </div>
      </div>

      {/* Metrics */}
      <div className="px-4 py-3 grid grid-cols-3 gap-2">
        {/* Bins */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Package className="w-3 h-3 text-orange-500" />
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {formatNumber(current.harvest_bins)}
          </p>
          {binsComparison !== null && (
            <div
              className={`flex items-center justify-center gap-0.5 text-xs ${
                binsComparison >= 0 ? 'text-green-600' : 'text-red-500'
              }`}
            >
              {binsComparison >= 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>{Math.abs(binsComparison)}%</span>
            </div>
          )}
          {binsComparison === null && (
            <p className="text-xs text-gray-400">bins</p>
          )}
        </div>

        {/* Apps */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <FileText className="w-3 h-3 text-blue-500" />
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {formatNumber(current.applications)}
          </p>
          <p className="text-xs text-gray-400">apps</p>
        </div>

        {/* Revenue */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <DollarSign className="w-3 h-3 text-green-500" />
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {formatCurrency(current.revenue)}
          </p>
          <p className="text-xs text-gray-400">revenue</p>
        </div>
      </div>
    </div>
  );
};

// Main component
const SeasonProgressCard = ({ onNavigate }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await analyticsAPI.getMultiCropSeasons();
        setData(response.data);
      } catch (err) {
        console.error('Failed to fetch multi-crop season data:', err);
        // Show more detail if available
        const errorDetail = err.response?.data?.error || err.response?.data?.detail || err.message || 'Unknown error';
        setError(`Failed to load season data: ${errorDetail}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Season Progress</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="animate-pulse space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32 mt-1"></div>
                  </div>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="text-center text-red-500 dark:text-red-400">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm mb-3">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              analyticsAPI.getMultiCropSeasons()
                .then(response => setData(response.data))
                .catch(err => {
                  const errorDetail = err.response?.data?.error || err.message || 'Unknown error';
                  setError(`Failed to load season data: ${errorDetail}`);
                })
                .finally(() => setLoading(false));
            }}
            className="text-xs text-blue-600 hover:text-blue-700 underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const categories = data?.categories || [];
  const tasks = data?.tasks || { overdue: 0, due_this_week: 0 };

  if (categories.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <Calendar className="w-8 h-8 mx-auto mb-2" />
          <p>No crop data available. Add crops to your fields to see season progress.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Season Progress</h2>
          {(tasks.overdue > 0 || tasks.due_this_week > 0) && (
            <div className="flex items-center gap-3 text-xs">
              {tasks.overdue > 0 && (
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                  <AlertTriangle className="w-3 h-3" />
                  {tasks.overdue} overdue
                </span>
              )}
              {tasks.due_this_week > 0 && (
                <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                  <Clock className="w-3 h-3" />
                  {tasks.due_this_week} due this week
                </span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => onNavigate && onNavigate('analytics')}
          className="text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 flex items-center gap-1"
        >
          View Analytics
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Crop Category Cards */}
      <div className={`grid gap-4 ${
        categories.length === 1
          ? 'grid-cols-1 max-w-md'
          : categories.length === 2
            ? 'grid-cols-1 md:grid-cols-2'
            : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
      }`}>
        {categories.map((cat) => (
          <CropSeasonMiniCard
            key={cat.category}
            data={cat}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
};

export default SeasonProgressCard;
