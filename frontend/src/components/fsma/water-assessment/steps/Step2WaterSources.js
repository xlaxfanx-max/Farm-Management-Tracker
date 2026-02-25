import React, { useState, useEffect } from 'react';
import { Droplets, Plus, Check, AlertCircle } from 'lucide-react';
import api from '../../../../services/api';

/**
 * Step 2: Water Sources
 *
 * Select water sources to include in this assessment.
 */
const Step2WaterSources = ({ formData, updateFormData }) => {
  const [waterSources, setWaterSources] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (formData.farm) {
      loadWaterSources();
    }
  }, [formData.farm]);

  const loadWaterSources = async () => {
    try {
      const response = await api.get('/water-sources/', {
        params: { farm: formData.farm },
      });
      setWaterSources(response.data.results || response.data);
    } catch (err) {
      console.error('Error loading water sources:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSource = (sourceId) => {
    const currentSelected = formData.selectedSources || [];
    let newSelected;

    if (currentSelected.includes(sourceId)) {
      newSelected = currentSelected.filter((id) => id !== sourceId);
    } else {
      newSelected = [...currentSelected, sourceId];
    }

    updateFormData({ selectedSources: newSelected });
  };

  const selectAll = () => {
    updateFormData({ selectedSources: waterSources.map((s) => s.id) });
  };

  const deselectAll = () => {
    updateFormData({ selectedSources: [] });
  };

  const getSourceTypeIcon = (type) => {
    const icons = {
      well: 'W',
      surface: 'S',
      municipal: 'M',
      pond: 'P',
      canal: 'C',
    };
    return icons[type] || '?';
  };

  const getSourceTypeColor = (type) => {
    const colors = {
      well: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
      surface: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400',
      municipal: 'bg-green-100 text-primary dark:bg-green-900/40 dark:text-green-400',
      pond: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400',
      canal: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400',
    };
    return colors[type] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  };

  if (!formData.farm) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">
          Please select a farm in Step 1 first.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (waterSources.length === 0) {
    return (
      <div className="text-center py-8">
        <Droplets className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          No water sources found for this farm.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500">
          Please add water sources to your farm before conducting a water assessment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selection Actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {formData.selectedSources?.length || 0} of {waterSources.length} sources selected
        </p>
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            className="text-sm text-primary dark:text-green-400 hover:underline"
          >
            Select All
          </button>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <button
            onClick={deselectAll}
            className="text-sm text-gray-600 dark:text-gray-400 hover:underline"
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* Water Sources Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {waterSources.map((source) => {
          const isSelected = formData.selectedSources?.includes(source.id);
          return (
            <button
              key={source.id}
              onClick={() => toggleSource(source.id)}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                isSelected
                  ? 'border-primary bg-primary-light dark:bg-green-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${getSourceTypeColor(
                      source.source_type
                    )}`}
                  >
                    {getSourceTypeIcon(source.source_type)}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {source.source_name}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                      {source.source_type_display || source.source_type}
                    </p>
                    {source.location_description && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {source.location_description}
                      </p>
                    )}
                  </div>
                </div>
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    isSelected
                      ? 'border-primary bg-green-500 text-white'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {isSelected && <Check className="w-4 h-4" />}
                </div>
              </div>

              {/* Source Details */}
              {source.source_type === 'well' && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400">
                    {source.well_depth && (
                      <span>Depth: {source.well_depth} ft</span>
                    )}
                    {source.casing_depth && (
                      <span>Casing: {source.casing_depth} ft</span>
                    )}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">
          Water Source Selection
        </h4>
        <p className="text-sm text-blue-700 dark:text-blue-400">
          Select all water sources that are used for pre-harvest agricultural water
          applications on this farm. Each selected source will be evaluated for
          physical condition, water quality testing, and contamination risks.
        </p>
      </div>
    </div>
  );
};

export default Step2WaterSources;
