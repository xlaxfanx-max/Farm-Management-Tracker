import React, { useState, useEffect } from 'react';
import { Building2, Calendar, User, FileText } from 'lucide-react';
import { fsmaAPI } from '../../../../services/api';

/**
 * Step 1: Farm Selection
 *
 * Select the farm, assessment year, and provide assessor information.
 */
const Step1FarmSelection = ({ formData, updateFormData }) => {
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  useEffect(() => {
    loadFarms();
  }, []);

  const loadFarms = async () => {
    try {
      const response = await fsmaAPI.getFarms();
      setFarms(response.data.results || response.data);
    } catch (err) {
      console.error('Error loading farms:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Farm Selection */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <Building2 className="w-4 h-4" />
          Farm *
        </label>
        <select
          value={formData.farm}
          onChange={(e) => updateFormData({ farm: e.target.value })}
          disabled={loading}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
        >
          <option value="">Select a farm...</option>
          {farms.map((farm) => (
            <option key={farm.id} value={farm.id}>
              {farm.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Select the farm this water assessment applies to
        </p>
      </div>

      {/* Assessment Year */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <Calendar className="w-4 h-4" />
          Assessment Year *
        </label>
        <select
          value={formData.assessment_year}
          onChange={(e) => updateFormData({ assessment_year: parseInt(e.target.value, 10) })}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Water assessments must be conducted annually per FDA requirements
        </p>
      </div>

      {/* Assessment Date */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <Calendar className="w-4 h-4" />
          Assessment Date
        </label>
        <input
          type="date"
          value={formData.assessment_date}
          onChange={(e) => updateFormData({ assessment_date: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Date the assessment is being conducted
        </p>
      </div>

      {/* Notes */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <FileText className="w-4 h-4" />
          Assessment Notes
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => updateFormData({ notes: e.target.value })}
          rows={4}
          placeholder="Add any general notes about this assessment..."
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">
          About Pre-Harvest Water Assessments
        </h4>
        <p className="text-sm text-blue-700 dark:text-blue-400">
          Per 21 CFR 112.43, covered farms must conduct an annual assessment of their
          pre-harvest agricultural water. This assessment evaluates water sources,
          application practices, and environmental factors to determine if the water
          is safe for use on produce.
        </p>
      </div>
    </div>
  );
};

export default Step1FarmSelection;
