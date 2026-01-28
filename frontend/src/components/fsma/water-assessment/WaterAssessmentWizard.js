import React, { useState, useEffect } from 'react';
import {
  Droplets,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Save,
  Send,
  AlertTriangle,
  Loader2,
  Download,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { fsmaAPI } from '../../../services/api';

// Step Components
import Step1FarmSelection from './steps/Step1FarmSelection';
import Step2WaterSources from './steps/Step2WaterSources';
import Step3SourceCondition from './steps/Step3SourceCondition';
import Step4FieldPractices from './steps/Step4FieldPractices';
import Step5CropContact from './steps/Step5CropContact';
import Step6Environmental from './steps/Step6Environmental';
import Step7RiskReview from './steps/Step7RiskReview';
import Step8SignSubmit from './steps/Step8SignSubmit';

/**
 * WaterAssessmentWizard Component
 *
 * 8-step wizard for completing FSMA Pre-Harvest Agricultural Water Assessment:
 * 1. Farm Selection - Select farm, year, assessor info
 * 2. Water Sources - Select sources to evaluate
 * 3. Source Condition - Physical condition, testing data
 * 4. Field Practices - Irrigation methods, timing
 * 5. Crop Contact - Contact type, die-off considerations
 * 6. Environmental - Adjacent land, flooding, wildlife
 * 7. Risk Review - Calculated risks, recommendations
 * 8. Sign & Submit - Signature capture, submit
 */
const WaterAssessmentWizard = ({ assessmentId, onComplete, onCancel }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(!!assessmentId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Form data for each step
  const [formData, setFormData] = useState({
    // Step 1: Farm Selection
    farm: '',
    assessment_year: new Date().getFullYear(),
    assessment_date: new Date().toISOString().split('T')[0],
    notes: '',

    // Step 2-3: Water Sources
    selectedSources: [],
    sourceAssessments: [],

    // Step 4-5: Field Practices
    selectedFields: [],
    fieldAssessments: [],

    // Step 6: Environmental
    environmentalAssessment: {
      cafo_within_1000ft: false,
      nearest_animal_operation_ft: null,
      adjacent_land_uses: [],
      flooding_history: false,
      flooding_last_12_months: false,
      septic_nearby: false,
      wildlife_pressure: 'low',
      notes: '',
    },

    // Step 7-8: Review & Submit
    mitigationActions: [],
    signature_data: null,
  });

  const steps = [
    { number: 1, title: 'Farm Selection', description: 'Select farm and year' },
    { number: 2, title: 'Water Sources', description: 'Choose sources to assess' },
    { number: 3, title: 'Source Condition', description: 'Evaluate source quality' },
    { number: 4, title: 'Field Practices', description: 'Irrigation methods' },
    { number: 5, title: 'Crop Contact', description: 'Water-crop contact' },
    { number: 6, title: 'Environmental', description: 'Environmental factors' },
    { number: 7, title: 'Risk Review', description: 'Review risk scores' },
    { number: 8, title: 'Sign & Submit', description: 'Complete assessment' },
  ];

  useEffect(() => {
    if (assessmentId) {
      loadAssessment();
    }
  }, [assessmentId]);

  const loadAssessment = async () => {
    try {
      setLoading(true);
      const response = await fsmaAPI.getWaterAssessment(assessmentId);
      const data = response.data;
      setAssessment(data);

      // Populate form data from existing assessment
      setFormData({
        farm: data.farm,
        assessment_year: data.assessment_year,
        assessment_date: data.assessment_date || new Date().toISOString().split('T')[0],
        notes: data.notes || '',
        selectedSources: data.source_assessments?.map((sa) => sa.water_source) || [],
        sourceAssessments: data.source_assessments || [],
        selectedFields: data.field_assessments?.map((fa) => fa.field) || [],
        fieldAssessments: data.field_assessments || [],
        environmentalAssessment: data.environmental_assessment || {
          cafo_within_1000ft: false,
          nearest_animal_operation_ft: null,
          adjacent_land_uses: [],
          flooding_history: false,
          flooding_last_12_months: false,
          septic_nearby: false,
          wildlife_pressure: 'low',
          notes: '',
        },
        mitigationActions: data.mitigation_actions || [],
        signature_data: null,
      });

      setError(null);
    } catch (err) {
      console.error('Error loading assessment:', err);
      setError('Failed to load assessment');
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (updates) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleSave = async (proceed = false) => {
    try {
      setSaving(true);
      setError(null);

      let savedAssessment = assessment;

      // Step 1: Create or update the main assessment
      if (currentStep >= 1) {
        if (assessment?.id) {
          // Update existing assessment
          const response = await fsmaAPI.updateWaterAssessment(assessment.id, {
            farm: formData.farm,
            assessment_year: formData.assessment_year,
            assessment_date: formData.assessment_date || null,
            notes: formData.notes,
            status: 'in_progress',
          });
          savedAssessment = response.data;
          setAssessment(savedAssessment);
        } else {
          // Create new assessment
          const response = await fsmaAPI.createWaterAssessment({
            farm: formData.farm,
            assessment_year: formData.assessment_year,
            assessment_date: formData.assessment_date || null,
            notes: formData.notes,
            status: 'in_progress',
          });
          savedAssessment = response.data;
          setAssessment(savedAssessment);
        }
      }

      // Steps 2-3: Save source assessments only when on step 3 or later
      if (currentStep >= 3 && formData.sourceAssessments?.length > 0) {
        const updatedSourceAssessments = [];
        for (const sourceAssess of formData.sourceAssessments) {
          if (sourceAssess.id) {
            await fsmaAPI.updateSourceAssessment(sourceAssess.id, {
              ...sourceAssess,
              assessment: savedAssessment.id,
            });
            updatedSourceAssessments.push(sourceAssess);
          } else if (sourceAssess.water_source) {
            const response = await fsmaAPI.createSourceAssessment({
              ...sourceAssess,
              assessment: savedAssessment.id,
            });
            // Capture the new ID
            updatedSourceAssessments.push({ ...sourceAssess, id: response.data.id });
          }
        }
        // Update formData with IDs
        updateFormData({ sourceAssessments: updatedSourceAssessments });
      }

      // Steps 4-5: Save field assessments only when on step 5 or later
      if (currentStep >= 5 && formData.fieldAssessments?.length > 0) {
        const updatedFieldAssessments = [];
        for (const fieldAssess of formData.fieldAssessments) {
          if (fieldAssess.id) {
            await fsmaAPI.updateFieldAssessment(fieldAssess.id, {
              ...fieldAssess,
              assessment: savedAssessment.id,
            });
            updatedFieldAssessments.push(fieldAssess);
          } else if (fieldAssess.field) {
            const response = await fsmaAPI.createFieldAssessment({
              ...fieldAssess,
              assessment: savedAssessment.id,
            });
            // Capture the new ID
            updatedFieldAssessments.push({ ...fieldAssess, id: response.data.id });
          }
        }
        // Update formData with IDs
        updateFormData({ fieldAssessments: updatedFieldAssessments });
      }

      // Step 6: Save environmental assessment only when on step 6 or later
      if (currentStep >= 6 && formData.environmentalAssessment) {
        const env = formData.environmentalAssessment;
        // Only save if user has actually filled in some data
        const hasEnvData = env.id || env.cafo_within_1000ft !== undefined ||
                          env.flooding_history !== undefined || env.septic_nearby !== undefined;
        if (hasEnvData) {
          const envData = {
            ...env,
            assessment: savedAssessment.id,
          };
          if (env.id) {
            await fsmaAPI.updateEnvironmentalAssessment(env.id, envData);
          } else {
            const response = await fsmaAPI.createEnvironmentalAssessment(envData);
            // Update formData with the new ID
            updateFormData({
              environmentalAssessment: { ...env, id: response.data.id }
            });
          }
        }
      }

      if (proceed) {
        setCurrentStep((prev) => Math.min(prev + 1, 8));
      }
    } catch (err) {
      console.error('Error saving assessment:', err);
      // Extract meaningful error message from API response
      let errorMessage = 'Failed to save assessment. Please try again.';
      if (err.response?.data) {
        const data = err.response.data;
        if (typeof data === 'string') {
          errorMessage = data;
        } else if (data.detail) {
          errorMessage = data.detail;
        } else if (data.non_field_errors) {
          errorMessage = data.non_field_errors.join(', ');
        } else if (typeof data === 'object') {
          // Handle field-specific errors
          const fieldErrors = Object.entries(data)
            .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
            .join('; ');
          if (fieldErrors) {
            errorMessage = fieldErrors;
          }
        }
      }
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleCalculateRisk = async () => {
    if (!assessment?.id) {
      await handleSave(false);
    }

    try {
      const response = await fsmaAPI.calculateWaterRisk(assessment?.id || formData.assessmentId);
      setAssessment(response.data);
      updateFormData({ mitigationActions: response.data.mitigation_actions || [] });
    } catch (err) {
      console.error('Error calculating risk:', err);
      setError('Failed to calculate risk scores');
    }
  };

  const handleSubmit = async (signatureData) => {
    try {
      setSaving(true);
      setError(null);
      await fsmaAPI.submitWaterAssessment(assessment.id, {
        signature_data: signatureData,
      });
      onComplete?.();
    } catch (err) {
      console.error('Error submitting assessment:', err);
      // Extract meaningful error message
      let errorMessage = 'Failed to submit assessment';
      if (err.response?.data) {
        const data = err.response.data;
        if (data.error) {
          errorMessage = data.error;
          if (data.details) {
            errorMessage += ': ' + (Array.isArray(data.details) ? data.details.join(', ') : data.details);
          }
        } else if (data.detail) {
          errorMessage = data.detail;
        } else if (typeof data === 'string') {
          errorMessage = data;
        }
      }
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.farm && formData.assessment_year;
      case 2:
        return formData.selectedSources.length > 0;
      case 3:
        return formData.sourceAssessments.length > 0;
      case 4:
        return formData.selectedFields.length > 0;
      case 5:
        return formData.fieldAssessments.length > 0;
      case 6:
        return true; // Environmental is optional but we need at least the form
      case 7:
        return assessment?.overall_risk_score !== null;
      case 8:
        return true;
      default:
        return false;
    }
  };

  const handleNext = async () => {
    if (currentStep < 8 && canProceed()) {
      await handleSave(true);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const renderStep = () => {
    const stepProps = {
      formData,
      updateFormData,
      assessment,
    };

    switch (currentStep) {
      case 1:
        return <Step1FarmSelection {...stepProps} />;
      case 2:
        return <Step2WaterSources {...stepProps} />;
      case 3:
        return <Step3SourceCondition {...stepProps} />;
      case 4:
        return <Step4FieldPractices {...stepProps} />;
      case 5:
        return <Step5CropContact {...stepProps} />;
      case 6:
        return <Step6Environmental {...stepProps} />;
      case 7:
        return (
          <Step7RiskReview
            {...stepProps}
            onCalculateRisk={handleCalculateRisk}
          />
        );
      case 8:
        return (
          <Step8SignSubmit
            {...stepProps}
            onSubmit={handleSubmit}
            saving={saving}
          />
        );
      default:
        return null;
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const response = await fsmaAPI.downloadWaterAssessmentPdf(assessment.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `water_assessment_${assessment.farm_name || assessment.id}_${assessment.assessment_year}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error downloading PDF:', err);
      setError('Failed to download PDF. The PDF may still be generating - please try again in a moment.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-12 h-12 text-green-600 animate-spin" />
      </div>
    );
  }

  // Show read-only view for approved assessments
  if (assessment?.status === 'approved') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Approved Water Assessment
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {assessment.farm_name} - {assessment.assessment_year}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <span className="text-red-700 dark:text-red-300">{error}</span>
            </div>
          </div>
        )}

        {/* Assessment Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Assessment Summary
            </h3>
            <span className="px-3 py-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded-full text-sm font-medium">
              Approved
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Farm</p>
              <p className="font-medium text-gray-900 dark:text-white mt-1">
                {assessment.farm_name}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Assessment Year</p>
              <p className="font-medium text-gray-900 dark:text-white mt-1">
                {assessment.assessment_year}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Risk Level</p>
              <p className={`font-medium mt-1 ${
                assessment.risk_level === 'low' ? 'text-green-600 dark:text-green-400' :
                assessment.risk_level === 'medium' ? 'text-yellow-600 dark:text-yellow-400' :
                assessment.risk_level === 'high' ? 'text-orange-600 dark:text-orange-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {assessment.risk_level?.toUpperCase() || 'N/A'}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Risk Score</p>
              <p className="font-medium text-gray-900 dark:text-white mt-1">
                {assessment.overall_risk_score !== null ? `${Math.round(assessment.overall_risk_score)} / 100` : 'N/A'}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Assessor</p>
              <p className="font-medium text-gray-900 dark:text-white mt-1">
                {assessment.assessor_name || 'N/A'}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Approved By</p>
              <p className="font-medium text-gray-900 dark:text-white mt-1">
                {assessment.approved_by_name || 'N/A'}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Approved Date</p>
              <p className="font-medium text-gray-900 dark:text-white mt-1">
                {assessment.approved_at ? new Date(assessment.approved_at).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Valid Until</p>
              <p className="font-medium text-gray-900 dark:text-white mt-1">
                {assessment.valid_until ? new Date(assessment.valid_until).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>

          {/* FDA Determination */}
          {assessment.fda_outcome && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-1">
                FDA Determination
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-400">
                {assessment.fda_determination_display || assessment.fda_outcome?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </p>
              {assessment.outcome_notes && (
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                  {assessment.outcome_notes}
                </p>
              )}
            </div>
          )}

          {/* Download PDF Button */}
          <div className="flex justify-center">
            <button
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-5 h-5" />
              Download PDF Report
            </button>
          </div>
        </div>

        {/* Back Button */}
        <div className="flex justify-start">
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
            <Droplets className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {assessment?.id ? 'Edit' : 'New'} Water Assessment
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              21 CFR 112.43 Pre-Harvest Agricultural Water Assessment
            </p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Step Progress */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between overflow-x-auto">
          {steps.map((step, index) => (
            <React.Fragment key={step.number}>
              <div
                className={`flex flex-col items-center min-w-[80px] ${
                  currentStep === step.number
                    ? 'text-green-600 dark:text-green-400'
                    : currentStep > step.number
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep === step.number
                      ? 'bg-green-600 text-white'
                      : currentStep > step.number
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {currentStep > step.number ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    step.number
                  )}
                </div>
                <span className="mt-1 text-xs font-medium text-center">
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${
                    currentStep > step.number
                      ? 'bg-green-600'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <span className="text-red-700 dark:text-red-300">{error}</span>
          </div>
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Step {currentStep}: {steps[currentStep - 1].title}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {steps[currentStep - 1].description}
          </p>
        </div>

        {renderStep()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleBack}
          disabled={currentStep === 1}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            currentStep === 1
              ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Save Draft
          </button>

          {currentStep < 8 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed() || saving}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                canProceed() && !saving
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }`}
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Next
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default WaterAssessmentWizard;
