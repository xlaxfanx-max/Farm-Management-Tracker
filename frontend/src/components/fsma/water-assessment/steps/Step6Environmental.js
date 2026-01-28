import React from 'react';
import { TreePine, AlertTriangle, Check, Plus, X, Info } from 'lucide-react';

/**
 * Step 6: Environmental Assessment
 *
 * Evaluate environmental factors that may affect water quality.
 */
const Step6Environmental = ({ formData, updateFormData }) => {
  const env = formData.environmentalAssessment || {};

  const updateEnvironmental = (updates) => {
    updateFormData({
      environmentalAssessment: {
        ...env,
        ...updates,
      },
    });
  };

  const wildlifePressureLevels = [
    { value: 'low', label: 'Low', description: 'Rare or minimal wildlife presence' },
    { value: 'medium', label: 'Medium', description: 'Occasional to regular wildlife activity' },
    { value: 'high', label: 'High', description: 'Frequent/significant wildlife presence' },
  ];

  const adjacentLandUseOptions = [
    'Livestock/Dairy Operations',
    'Residential Areas',
    'Industrial Facilities',
    'Agricultural (Row Crops)',
    'Agricultural (Orchards)',
    'Forest/Woodland',
    'Wetlands',
    'Roads/Highways',
    'Golf Course',
    'Sewage Treatment',
  ];

  const toggleAdjacentLandUse = (use) => {
    const current = env.adjacent_land_uses || [];
    const updated = current.includes(use)
      ? current.filter((u) => u !== use)
      : [...current, use];
    updateEnvironmental({ adjacent_land_uses: updated });
  };

  const addIdentifiedRisk = () => {
    const risk = window.prompt('Enter the identified environmental risk:');
    if (risk && risk.trim()) {
      const current = env.identified_risks || [];
      updateEnvironmental({ identified_risks: [...current, risk.trim()] });
    }
  };

  const removeIdentifiedRisk = (index) => {
    const current = env.identified_risks || [];
    updateEnvironmental({
      identified_risks: current.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-6">
      {/* CAFO Proximity */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <TreePine className="w-5 h-5 text-green-600" />
          Animal Operations Proximity
        </h4>

        <div className="space-y-4">
          {/* CAFO Within 1000ft */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-700 dark:text-gray-300">
                CAFO (Concentrated Animal Feeding Operation) within 1000 feet?
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                High-density animal operations pose significant contamination risk
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => updateEnvironmental({ cafo_within_1000ft: true })}
                className={`px-4 py-2 rounded-lg border-2 transition-all ${
                  env.cafo_within_1000ft === true
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                Yes
              </button>
              <button
                onClick={() => updateEnvironmental({ cafo_within_1000ft: false })}
                className={`px-4 py-2 rounded-lg border-2 transition-all ${
                  env.cafo_within_1000ft === false
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                No
              </button>
            </div>
          </div>

          {/* Nearest Animal Operation Distance */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Distance to Nearest Animal Operation (feet)
            </label>
            <input
              type="number"
              value={env.nearest_animal_operation_ft || ''}
              onChange={(e) =>
                updateEnvironmental({
                  nearest_animal_operation_ft: e.target.value
                    ? parseInt(e.target.value, 10)
                    : null,
                })
              }
              min="0"
              placeholder="Enter distance in feet"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            {env.nearest_animal_operation_ft && env.nearest_animal_operation_ft < 400 && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Very close proximity - high contamination risk
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Flooding History */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 dark:text-white mb-4">
          Flooding History
        </h4>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-700 dark:text-gray-300">
                History of flooding in growing areas?
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Past flooding events can indicate contamination risk
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => updateEnvironmental({ flooding_history: true })}
                className={`px-4 py-2 rounded-lg border-2 transition-all ${
                  env.flooding_history === true
                    ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                Yes
              </button>
              <button
                onClick={() => updateEnvironmental({ flooding_history: false })}
                className={`px-4 py-2 rounded-lg border-2 transition-all ${
                  env.flooding_history === false
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                No
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-700 dark:text-gray-300">
                Any flooding events in the last 12 months?
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Recent flooding requires immediate attention
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => updateEnvironmental({ flooding_last_12_months: true })}
                className={`px-4 py-2 rounded-lg border-2 transition-all ${
                  env.flooding_last_12_months === true
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                Yes
              </button>
              <button
                onClick={() => updateEnvironmental({ flooding_last_12_months: false })}
                className={`px-4 py-2 rounded-lg border-2 transition-all ${
                  env.flooding_last_12_months === false
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                No
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Other Environmental Factors */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 dark:text-white mb-4">
          Other Environmental Factors
        </h4>

        <div className="space-y-4">
          {/* Septic System */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-700 dark:text-gray-300">
                Septic system nearby?
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Septic systems can contaminate groundwater
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => updateEnvironmental({ septic_nearby: true })}
                className={`px-4 py-2 rounded-lg border-2 transition-all ${
                  env.septic_nearby === true
                    ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                Yes
              </button>
              <button
                onClick={() => updateEnvironmental({ septic_nearby: false })}
                className={`px-4 py-2 rounded-lg border-2 transition-all ${
                  env.septic_nearby === false
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                No
              </button>
            </div>
          </div>

          {/* Wildlife Pressure */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Wildlife Pressure Level
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {wildlifePressureLevels.map((level) => (
                <button
                  key={level.value}
                  onClick={() => updateEnvironmental({ wildlife_pressure: level.value })}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    env.wildlife_pressure === level.value
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    {level.label}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {level.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Adjacent Land Uses */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 dark:text-white mb-4">
          Adjacent Land Uses
        </h4>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Select all land uses adjacent to your growing areas:
        </p>
        <div className="flex flex-wrap gap-2">
          {adjacentLandUseOptions.map((use) => {
            const isSelected = env.adjacent_land_uses?.includes(use);
            return (
              <button
                key={use}
                onClick={() => toggleAdjacentLandUse(use)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  isSelected
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                {use}
              </button>
            );
          })}
        </div>
      </div>

      {/* Identified Risks */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-gray-900 dark:text-white">
            Additional Identified Risks
          </h4>
          <button
            onClick={addIdentifiedRisk}
            className="inline-flex items-center gap-1 text-sm text-green-600 dark:text-green-400 hover:underline"
          >
            <Plus className="w-4 h-4" />
            Add Risk
          </button>
        </div>

        {env.identified_risks?.length > 0 ? (
          <div className="space-y-2">
            {env.identified_risks.map((risk, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span className="text-sm text-red-700 dark:text-red-300">{risk}</span>
                </div>
                <button
                  onClick={() => removeIdentifiedRisk(index)}
                  className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No additional risks identified. Click "Add Risk" to document any concerns.
          </p>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Environmental Assessment Notes
        </label>
        <textarea
          value={env.notes || ''}
          onChange={(e) => updateEnvironmental({ notes: e.target.value })}
          rows={4}
          placeholder="Add notes about environmental conditions..."
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-1">
              Environmental Assessment
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-400">
              Environmental factors can significantly impact water quality and contamination risk.
              The FDA requires consideration of animal operations, flooding history, and other
              potential sources of contamination when assessing pre-harvest agricultural water.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step6Environmental;
