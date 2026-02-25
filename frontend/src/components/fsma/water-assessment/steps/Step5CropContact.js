import React, { useState, useEffect } from 'react';
import { Leaf, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { fsmaAPI } from '../../../../services/api';

/**
 * Step 5: Crop Contact
 *
 * Specify water-crop contact type and die-off timing for each field.
 */
const Step5CropContact = ({ formData, updateFormData }) => {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeField, setActiveField] = useState(null);

  useEffect(() => {
    loadFields();
  }, [formData.selectedFields]);

  const loadFields = async () => {
    if (!formData.selectedFields?.length) {
      setLoading(false);
      return;
    }

    try {
      const response = await fsmaAPI.getFields();
      const selectedFieldObjects = (response.data.results || response.data).filter(
        (field) => formData.selectedFields.includes(field.id)
      );
      setFields(selectedFieldObjects);

      if (selectedFieldObjects.length > 0 && !activeField) {
        setActiveField(selectedFieldObjects[0].id);
      }
    } catch (err) {
      console.error('Error loading fields:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateFieldAssessment = (fieldId, updates) => {
    const newAssessments = formData.fieldAssessments.map((assessment) =>
      assessment.field === fieldId ? { ...assessment, ...updates } : assessment
    );
    updateFormData({ fieldAssessments: newAssessments });
  };

  const getAssessment = (fieldId) => {
    return formData.fieldAssessments?.find((a) => a.field === fieldId) || {};
  };

  const getField = (fieldId) => {
    return fields.find((f) => f.id === fieldId);
  };

  const cropContactTypes = [
    {
      value: 'soil_only',
      label: 'Soil Only',
      description: 'Water applied to soil only, no crop contact',
      risk: 'low',
    },
    {
      value: 'indirect',
      label: 'Indirect Contact',
      description: 'Water contacts non-harvestable portions only',
      risk: 'medium',
    },
    {
      value: 'direct',
      label: 'Direct Contact',
      description: 'Water directly contacts harvestable portions',
      risk: 'high',
    },
  ];

  const calculateDieOff = (assessment) => {
    // FDA die-off formula: (log10(GM) - log10(126)) / 0.5
    // Returns required days for die-off
    if (!assessment.ecoli_gm_from_source) return null;
    const gm = assessment.ecoli_gm_from_source;
    if (gm <= 126) return 0;
    const days = Math.ceil((Math.log10(gm) - Math.log10(126)) / 0.5);
    return days;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!formData.selectedFields?.length) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">
          Please select fields in Step 4 first.
        </p>
      </div>
    );
  }

  const currentAssessment = getAssessment(activeField);
  const currentField = getField(activeField);

  return (
    <div className="space-y-6">
      {/* Field Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {fields.map((field) => {
          const assessment = getAssessment(field.id);
          const hasData = assessment.crop_contact_type;
          return (
            <button
              key={field.id}
              onClick={() => setActiveField(field.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                activeField === field.id
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Leaf className="w-4 h-4" />
              {field.name}
              {hasData && <CheckCircle2 className="w-4 h-4 text-green-300" />}
            </button>
          );
        })}
      </div>

      {currentField && (
        <div className="space-y-6">
          {/* Field Info */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Field:</span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {currentField.name}
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Crop:</span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {currentField.crop_type || 'Not specified'}
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Acreage:</span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {currentField.acreage} acres
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Application:</span>
                <p className="font-medium text-gray-900 dark:text-white capitalize">
                  {currentAssessment.application_method?.replace('_', ' ') || 'Not set'}
                </p>
              </div>
            </div>
          </div>

          {/* Crop Contact Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Water-Crop Contact Type
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {cropContactTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() =>
                    updateFieldAssessment(activeField, {
                      crop_contact_type: type.value,
                    })
                  }
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    currentAssessment.crop_contact_type === type.value
                      ? 'border-primary bg-primary-light dark:bg-green-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {type.label}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {type.description}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded ${
                        type.risk === 'low'
                          ? 'bg-green-100 text-primary dark:bg-green-900/40 dark:text-green-400'
                          : type.risk === 'medium'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                      }`}
                    >
                      {type.risk} risk
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Days Before Harvest */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Typical Days Before Harvest (Last Application)
              </label>
              <input
                type="number"
                value={currentAssessment.typical_days_before_harvest || ''}
                onChange={(e) =>
                  updateFieldAssessment(activeField, {
                    typical_days_before_harvest: e.target.value
                      ? parseInt(e.target.value, 10)
                      : null,
                  })
                }
                min="0"
                placeholder="Enter days"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Time between last water application and harvest
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Die-off Period Adequate?
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() =>
                    updateFieldAssessment(activeField, { die_off_period_adequate: true })
                  }
                  className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                    currentAssessment.die_off_period_adequate === true
                      ? 'border-primary bg-primary-light dark:bg-green-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <CheckCircle2
                    className={`w-5 h-5 mx-auto ${
                      currentAssessment.die_off_period_adequate === true
                        ? 'text-primary'
                        : 'text-gray-400'
                    }`}
                  />
                  <span className="block text-sm mt-1">Yes</span>
                </button>
                <button
                  onClick={() =>
                    updateFieldAssessment(activeField, { die_off_period_adequate: false })
                  }
                  className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                    currentAssessment.die_off_period_adequate === false
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <AlertTriangle
                    className={`w-5 h-5 mx-auto ${
                      currentAssessment.die_off_period_adequate === false
                        ? 'text-red-600'
                        : 'text-gray-400'
                    }`}
                  />
                  <span className="block text-sm mt-1">No</span>
                </button>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Field Notes
            </label>
            <textarea
              value={currentAssessment.notes || ''}
              onChange={(e) =>
                updateFieldAssessment(activeField, { notes: e.target.value })
              }
              rows={3}
              placeholder="Add notes about water application practices for this field..."
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
              Die-off Interval
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-400">
              If water quality exceeds FDA thresholds, a die-off interval may be required
              between the last water application and harvest. The FDA formula calculates
              the number of days needed based on E. coli levels: (log10(GM) - log10(126)) / 0.5.
              Ensure sufficient time between last application and harvest to meet this requirement.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step5CropContact;
