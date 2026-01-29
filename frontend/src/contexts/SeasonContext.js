/**
 * SeasonContext
 *
 * Provides season state management across the application.
 * Persists selected season to localStorage so it remembers the user's choice
 * across page navigation and browser sessions.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { seasonAPI } from '../services/api';

const SeasonContext = createContext();

export const useSeason = () => {
  const context = useContext(SeasonContext);
  if (!context) {
    throw new Error('useSeason must be used within a SeasonProvider');
  }
  return context;
};

export const SeasonProvider = ({ children }) => {
  // Season selection state
  const [selectedSeason, setSelectedSeasonState] = useState(() => {
    // Check localStorage for saved season preference
    const saved = localStorage.getItem('grove-selected-season');
    return saved || '';
  });

  // Season metadata (dates, type, etc.)
  const [seasonDates, setSeasonDates] = useState(null);
  const [seasonInfo, setSeasonInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch current season info on mount
  useEffect(() => {
    const fetchSeasonInfo = async () => {
      try {
        const response = await seasonAPI.getSeasonInfo({ crop_category: 'citrus' });
        setSeasonInfo(response.data);

        // If no season selected, default to current season
        if (!selectedSeason && response.data.current_season) {
          setSelectedSeasonState(response.data.current_season.label);
          localStorage.setItem('grove-selected-season', response.data.current_season.label);
        }

        // If saved season is in calendar-year format but we have citrus seasons,
        // update to the matching citrus season format
        if (selectedSeason && !selectedSeason.includes('-') && response.data.available_seasons) {
          const matchingSeason = response.data.available_seasons.find(s =>
            s.label.startsWith(selectedSeason) || s.label.endsWith(selectedSeason)
          );
          if (matchingSeason) {
            setSelectedSeasonState(matchingSeason.label);
            localStorage.setItem('grove-selected-season', matchingSeason.label);
          }
        }
      } catch (err) {
        console.error('Failed to fetch season info:', err);
        setError('Failed to load season information');

        // Fallback to citrus season calculation if API fails
        if (!selectedSeason) {
          const today = new Date();
          const year = today.getFullYear();
          const month = today.getMonth() + 1;
          const fallbackSeason = month >= 10 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
          setSelectedSeasonState(fallbackSeason);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSeasonInfo();
  }, []);

  // Fetch date range when selected season changes
  useEffect(() => {
    const fetchSeasonDates = async () => {
      if (!selectedSeason) {
        setSeasonDates(null);
        return;
      }

      try {
        const response = await seasonAPI.getSeasonDateRange({ season: selectedSeason });
        setSeasonDates(response.data);
      } catch (err) {
        console.error('Failed to fetch season dates:', err);
        setSeasonDates(null);
      }
    };

    fetchSeasonDates();
  }, [selectedSeason]);

  // Update season selection and persist to localStorage
  const setSelectedSeason = useCallback((season) => {
    setSelectedSeasonState(season);
    if (season) {
      localStorage.setItem('grove-selected-season', season);
    } else {
      localStorage.removeItem('grove-selected-season');
    }
  }, []);

  // Get available seasons from the info
  const availableSeasons = seasonInfo?.available_seasons || [];

  // Check if selected season is the current season
  const isCurrentSeason = seasonInfo?.current_season?.label === selectedSeason;

  // Helper to get formatted date range string
  const getDateRangeString = useCallback(() => {
    if (!seasonDates) return '';
    const formatDate = (dateStr) => {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    };
    return `${formatDate(seasonDates.start_date)} - ${formatDate(seasonDates.end_date)}`;
  }, [seasonDates]);

  // Calculate season progress percentage
  const getSeasonProgress = useCallback(() => {
    if (!seasonDates) return null;

    const today = new Date();
    const start = new Date(seasonDates.start_date + 'T00:00:00');
    const end = new Date(seasonDates.end_date + 'T00:00:00');

    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.ceil((today - start) / (1000 * 60 * 60 * 24));

    return {
      totalDays,
      elapsedDays: Math.max(0, Math.min(elapsedDays, totalDays)),
      percent: Math.max(0, Math.min(100, Math.round((elapsedDays / totalDays) * 100))),
      isActive: today >= start && today <= end,
      isPast: today > end,
      isFuture: today < start,
    };
  }, [seasonDates]);

  // Reset to current season
  const resetToCurrentSeason = useCallback(() => {
    if (seasonInfo?.current_season) {
      setSelectedSeason(seasonInfo.current_season.label);
    }
  }, [seasonInfo, setSelectedSeason]);

  const value = {
    // State
    selectedSeason,
    seasonDates,
    seasonInfo,
    availableSeasons,
    loading,
    error,

    // Computed
    isCurrentSeason,

    // Actions
    setSelectedSeason,
    resetToCurrentSeason,

    // Helpers
    getDateRangeString,
    getSeasonProgress,
  };

  return (
    <SeasonContext.Provider value={value}>
      {children}
    </SeasonContext.Provider>
  );
};

export default SeasonContext;
