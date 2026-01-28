/**
 * SeasonSelector Component
 *
 * A reusable component for selecting seasons that adapts based on field/crop context.
 * Automatically determines the correct season format (e.g., "2024-2025" for citrus,
 * "2024" for calendar-year crops).
 *
 * Usage:
 *   <SeasonSelector
 *     value={selectedSeason}
 *     onChange={setSelectedSeason}
 *     fieldId={123}  // Optional: for field-specific seasons
 *     cropCategory="citrus"  // Optional: for category-specific seasons
 *   />
 */

import React, { useState, useEffect } from 'react';
import { seasonAPI } from '../services/api';

const SeasonSelector = ({
  value,
  onChange,
  fieldId = null,
  cropCategory = null,
  className = '',
  disabled = false,
  showCurrentBadge = true,
  placeholder = 'Select Season',
  yearsBack = 5,
  yearsForward = 1,
}) => {
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSeasons = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = {};
        if (fieldId) params.field_id = fieldId;
        if (cropCategory) params.crop_category = cropCategory;

        const response = await seasonAPI.getSeasonInfo(params);
        setSeasons(response.data.available_seasons || []);

        // Auto-select current season if no value is set
        if (!value && response.data.current_season) {
          onChange(response.data.current_season.label);
        }
      } catch (err) {
        console.error('Failed to fetch seasons:', err);
        setError('Failed to load seasons');

        // Fall back to simple year options on error
        const currentYear = new Date().getFullYear();
        const fallbackSeasons = [];
        for (let i = yearsBack; i >= -yearsForward; i--) {
          const year = currentYear - i;
          fallbackSeasons.push({
            label: String(year),
            start_date: `${year}-01-01`,
            end_date: `${year}-12-31`,
            is_current: year === currentYear,
          });
        }
        setSeasons(fallbackSeasons);

        if (!value) {
          onChange(String(currentYear));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSeasons();
  }, [fieldId, cropCategory]);

  if (loading) {
    return (
      <select disabled className={className}>
        <option>Loading seasons...</option>
      </select>
    );
  }

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      disabled={disabled}
    >
      {!value && <option value="">{placeholder}</option>}
      {seasons.map((season) => (
        <option key={season.label} value={season.label}>
          {season.label}
          {showCurrentBadge && season.is_current ? ' (Current)' : ''}
        </option>
      ))}
    </select>
  );
};

/**
 * SeasonSelectorWithInfo Component
 *
 * Extended version that also displays the date range for the selected season.
 */
export const SeasonSelectorWithInfo = ({
  value,
  onChange,
  fieldId = null,
  cropCategory = null,
  className = '',
  disabled = false,
}) => {
  const [seasonInfo, setSeasonInfo] = useState(null);

  useEffect(() => {
    const fetchSeasonInfo = async () => {
      if (!value) {
        setSeasonInfo(null);
        return;
      }

      try {
        const params = { season: value };
        if (fieldId) params.field_id = fieldId;
        if (cropCategory) params.crop_category = cropCategory;

        const response = await seasonAPI.getSeasonDateRange(params);
        setSeasonInfo(response.data);
      } catch (err) {
        console.error('Failed to fetch season info:', err);
        setSeasonInfo(null);
      }
    };

    fetchSeasonInfo();
  }, [value, fieldId, cropCategory]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="season-selector-with-info">
      <SeasonSelector
        value={value}
        onChange={onChange}
        fieldId={fieldId}
        cropCategory={cropCategory}
        className={className}
        disabled={disabled}
      />
      {seasonInfo && (
        <div className="season-date-range text-sm text-gray-500 mt-1">
          {formatDate(seasonInfo.start_date)} - {formatDate(seasonInfo.end_date)}
        </div>
      )}
    </div>
  );
};

/**
 * useSeasonInfo Hook
 *
 * Custom hook for fetching season information.
 *
 * Usage:
 *   const { currentSeason, availableSeasons, loading, error } = useSeasonInfo(fieldId, cropCategory);
 */
export const useSeasonInfo = (fieldId = null, cropCategory = null) => {
  const [data, setData] = useState({
    currentSeason: null,
    availableSeasons: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    const fetchSeasonInfo = async () => {
      try {
        const params = {};
        if (fieldId) params.field_id = fieldId;
        if (cropCategory) params.crop_category = cropCategory;

        const response = await seasonAPI.getSeasonInfo(params);
        setData({
          currentSeason: response.data.current_season,
          availableSeasons: response.data.available_seasons || [],
          loading: false,
          error: null,
        });
      } catch (err) {
        console.error('Failed to fetch season info:', err);
        setData((prev) => ({
          ...prev,
          loading: false,
          error: 'Failed to load season information',
        }));
      }
    };

    fetchSeasonInfo();
  }, [fieldId, cropCategory]);

  return data;
};

export default SeasonSelector;
