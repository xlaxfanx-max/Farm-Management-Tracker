import React, { useState, useEffect } from 'react';
import { Leaf, Check, AlertCircle } from 'lucide-react';
import { fsmaAPI } from '../../../../services/api';

/**
 * Step 4: Field Practices
 *
 * Select fields and specify irrigation methods for each.
 */
const Step4FieldPractices = ({ formData, updateFormData }) => {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (formData.farm) {
      loadFields();
    }
  }, [formData.farm]);

  const loadFields = async () => {
    try {
      const response = await fsmaAPI.getFields();
      // Filter fields by the selected farm
      const farmFields = (response.data.results || response.data).filter(
        (field) => field.farm === parseInt(formData.farm, 10)
      );
      setFields(farmFields);

      // Initialize field assessments if not already done
      if (!formData.fieldAssessments?.length && formData.selectedFields?.length) {
        initializeFieldAssessments(formData.selectedFields, farmFields);
      }
    } catch (err) {
      console.error('Error loading fields:', err);
    } finally {
      setLoading(false);
    }
  };

  const initializeFieldAssessments = (selectedIds, allFields) => {
    const assessments = selectedIds.map((fieldId) => {
      const field = allFields.find((f) => f.id === fieldId);
      return {
        field: fieldId,
        application_method: field?.irrigation_type || 'drip',
        crop_contact_type: 'soil_only',
        typical_days_before_harvest: null,
        notes: '',
      };
    });
    updateFormData({ fieldAssessments: assessments });
  };

  const toggleField = (fieldId) => {
    const currentSelected = formData.selectedFields || [];
    let newSelected;

    if (currentSelected.includes(fieldId)) {
      newSelected = currentSelected.filter((id) => id !== fieldId);
      // Remove assessment for this field
      const newAssessments = formData.fieldAssessments?.filter(
        (a) => a.field !== fieldId
      ) || [];
      updateFormData({
        selectedFields: newSelected,
        fieldAssessments: newAssessments,
      });
    } else {
      newSelected = [...currentSelected, fieldId];
      // Add assessment for this field
      const field = fields.find((f) => f.id === fieldId);
      const newAssessment = {
        field: fieldId,
        application_method: field?.irrigation_type || 'drip',
        crop_contact_type: 'soil_only',
        typical_days_before_harvest: null,
        notes: '',
      };
      updateFormData({
        selectedFields: newSelected,
        fieldAssessments: [...(formData.fieldAssessments || []), newAssessment],
      });
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

  const applicationMethods = [
    { value: 'drip', label: 'Drip/Micro-irrigation', risk: 'low' },
    { value: 'subsurface', label: 'Subsurface Drip', risk: 'low' },
    { value: 'micro_sprinkler', label: 'Micro-Sprinkler', risk: 'medium' },
    { value: 'overhead', label: 'Overhead Sprinkler', risk: 'high' },
    { value: 'furrow', label: 'Furrow/Flood', risk: 'high' },
    { value: 'hand_watering', label: 'Hand Watering', risk: 'medium' },
    { value: 'none', label: 'No Irrigation', risk: 'low' },
  ];

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div className="text-center py-8">
        <Leaf className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          No fields found for this farm.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500">
          Please add fields to your farm before conducting a water assessment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Select the fields where pre-harvest agricultural water is applied and specify
        the irrigation method used for each field.
      </p>

      {/* Fields List */}
      <div className="space-y-4">
        {fields.map((field) => {
          const isSelected = formData.selectedFields?.includes(field.id);
          const assessment = getAssessment(field.id);

          return (
            <div
              key={field.id}
              className={`border-2 rounded-lg transition-all ${
                isSelected
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/10'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              {/* Field Header */}
              <button
                onClick={() => toggleField(field.id)}
                className="w-full p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isSelected
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    <Leaf className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {field.name}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {field.acreage} acres - {field.crop_type || 'No crop specified'}
                    </p>
                  </div>
                </div>
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    isSelected
                      ? 'border-green-500 bg-green-500 text-white'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {isSelected && <Check className="w-4 h-4" />}
                </div>
              </button>

              {/* Field Settings (expanded when selected) */}
              {isSelected && (
                <div className="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700 space-y-4">
                  {/* Application Method */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Water Application Method
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {applicationMethods.map((method) => (
                        <button
                          key={method.value}
                          onClick={() =>
                            updateFieldAssessment(field.id, {
                              application_method: method.value,
                            })
                          }
                          className={`p-2 text-sm rounded-lg border transition-colors ${
                            assessment.application_method === method.value
                              ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                              : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                          }`}
                        >
                          <span className="block font-medium">{method.label}</span>
                          <span
                            className={`text-xs ${
                              method.risk === 'low'
                                ? 'text-green-600'
                                : method.risk === 'medium'
                                ? 'text-yellow-600'
                                : 'text-red-600'
                            }`}
                          >
                            {method.risk} risk
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">
          Irrigation Method Risk Levels
        </h4>
        <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
          <li>
            <strong>Low Risk:</strong> Drip irrigation minimizes contact with harvestable portions
          </li>
          <li>
            <strong>Medium Risk:</strong> Some contact possible, depending on crop and timing
          </li>
          <li>
            <strong>High Risk:</strong> Overhead/flood methods increase contact with produce
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Step4FieldPractices;
