import React, { useState, useEffect } from 'react';
import { Droplets, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import api from '../../../../services/api';

/**
 * Step 3: Source Condition
 *
 * Evaluate physical condition and water quality testing data for each selected source.
 */
const Step3SourceCondition = ({ formData, updateFormData }) => {
  const [waterSources, setWaterSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSource, setActiveSource] = useState(null);

  useEffect(() => {
    loadSelectedSources();
  }, [formData.selectedSources]);

  const loadSelectedSources = async () => {
    if (!formData.selectedSources?.length) {
      setLoading(false);
      return;
    }

    try {
      const response = await api.get('/water-sources/', {
        params: { ids: formData.selectedSources.join(',') },
      });
      const sources = response.data.results || response.data;
      setWaterSources(sources);

      // Initialize source assessments if not already done
      if (!formData.sourceAssessments?.length) {
        const initialAssessments = sources.map((source) => ({
          water_source: source.id,
          physical_condition: 'good',
          testing_frequency: 'annual',
          ecoli_gm: null,
          ecoli_stv: null,
          meets_gm_threshold: true,
          meets_stv_threshold: true,
          contamination_risks: [],
          notes: '',
        }));
        updateFormData({ sourceAssessments: initialAssessments });
      }

      if (sources.length > 0 && !activeSource) {
        setActiveSource(sources[0].id);
      }
    } catch (err) {
      console.error('Error loading water sources:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateSourceAssessment = (sourceId, updates) => {
    const newAssessments = formData.sourceAssessments.map((assessment) =>
      assessment.water_source === sourceId
        ? { ...assessment, ...updates }
        : assessment
    );
    updateFormData({ sourceAssessments: newAssessments });
  };

  const getAssessment = (sourceId) => {
    return formData.sourceAssessments?.find((a) => a.water_source === sourceId) || {};
  };

  const getSource = (sourceId) => {
    return waterSources.find((s) => s.id === sourceId);
  };

  const physicalConditions = [
    { value: 'excellent', label: 'Excellent', description: 'No issues observed' },
    { value: 'good', label: 'Good', description: 'Minor issues, no immediate concern' },
    { value: 'fair', label: 'Fair', description: 'Some issues that need attention' },
    { value: 'poor', label: 'Poor', description: 'Significant issues requiring action' },
  ];

  const testingFrequencies = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'annual', label: 'Annual' },
    { value: 'none', label: 'No Testing Program' },
  ];

  const contaminationRiskOptions = [
    'Animal access to source',
    'Debris/sediment present',
    'Agricultural runoff nearby',
    'Septic system proximity',
    'Industrial contamination risk',
    'Flood-prone area',
    'Wellhead damage',
    'Backflow risk',
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!formData.selectedSources?.length) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">
          Please select water sources in Step 2 first.
        </p>
      </div>
    );
  }

  const currentAssessment = getAssessment(activeSource);
  const currentSource = getSource(activeSource);

  return (
    <div className="space-y-6">
      {/* Source Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {waterSources.map((source) => {
          const assessment = getAssessment(source.id);
          const hasData = assessment.physical_condition || assessment.ecoli_gm;
          return (
            <button
              key={source.id}
              onClick={() => setActiveSource(source.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                activeSource === source.id
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Droplets className="w-4 h-4" />
              {source.source_name}
              {hasData && (
                <CheckCircle2 className="w-4 h-4 text-green-300" />
              )}
            </button>
          );
        })}
      </div>

      {currentSource && (
        <div className="space-y-6">
          {/* Physical Condition */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Physical Condition
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {physicalConditions.map((condition) => (
                <button
                  key={condition.value}
                  onClick={() =>
                    updateSourceAssessment(activeSource, {
                      physical_condition: condition.value,
                    })
                  }
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    currentAssessment.physical_condition === condition.value
                      ? 'border-primary bg-primary-light dark:bg-green-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <p className="font-medium text-gray-900 dark:text-white">
                    {condition.label}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {condition.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Testing Frequency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Water Quality Testing Frequency
            </label>
            <select
              value={currentAssessment.testing_frequency || 'annual'}
              onChange={(e) =>
                updateSourceAssessment(activeSource, {
                  testing_frequency: e.target.value,
                })
              }
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {testingFrequencies.map((freq) => (
                <option key={freq.value} value={freq.value}>
                  {freq.label}
                </option>
              ))}
            </select>
          </div>

          {/* E. coli Test Results */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                E. coli Geometric Mean (GM) - CFU/100mL
              </label>
              <input
                type="number"
                value={currentAssessment.ecoli_gm || ''}
                onChange={(e) =>
                  updateSourceAssessment(activeSource, {
                    ecoli_gm: e.target.value ? parseFloat(e.target.value) : null,
                    meets_gm_threshold: e.target.value ? parseFloat(e.target.value) <= 126 : true,
                  })
                }
                placeholder="Enter GM value"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                FDA threshold: 126 CFU/100mL
              </p>
              {currentAssessment.ecoli_gm > 126 && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Exceeds FDA threshold
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                E. coli Statistical Threshold Value (STV) - CFU/100mL
              </label>
              <input
                type="number"
                value={currentAssessment.ecoli_stv || ''}
                onChange={(e) =>
                  updateSourceAssessment(activeSource, {
                    ecoli_stv: e.target.value ? parseFloat(e.target.value) : null,
                    meets_stv_threshold: e.target.value ? parseFloat(e.target.value) <= 410 : true,
                  })
                }
                placeholder="Enter STV value"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                FDA threshold: 410 CFU/100mL
              </p>
              {currentAssessment.ecoli_stv > 410 && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Exceeds FDA threshold
                </p>
              )}
            </div>
          </div>

          {/* Contamination Risks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Identified Contamination Risks
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {contaminationRiskOptions.map((risk) => {
                const isSelected = currentAssessment.contamination_risks?.includes(risk);
                return (
                  <button
                    key={risk}
                    onClick={() => {
                      const current = currentAssessment.contamination_risks || [];
                      const updated = isSelected
                        ? current.filter((r) => r !== risk)
                        : [...current, risk];
                      updateSourceAssessment(activeSource, {
                        contamination_risks: updated,
                      });
                    }}
                    className={`p-2 text-sm rounded-lg border transition-colors ${
                      isSelected
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                    }`}
                  >
                    {risk}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Source Notes
            </label>
            <textarea
              value={currentAssessment.notes || ''}
              onChange={(e) =>
                updateSourceAssessment(activeSource, { notes: e.target.value })
              }
              rows={3}
              placeholder="Add notes about this water source..."
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            />
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-1">
              FDA Water Quality Standards
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-400">
              The FDA requires that agricultural water meet the following E. coli thresholds:
              Geometric Mean (GM) of 126 CFU/100mL and Statistical Threshold Value (STV) of
              410 CFU/100mL. Water exceeding these limits may require treatment or die-off
              intervals before use.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step3SourceCondition;
