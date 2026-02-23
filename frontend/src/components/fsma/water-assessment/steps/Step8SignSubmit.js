import React, { useState, useRef } from 'react';
import {
  Send,
  PenTool,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Loader2,
} from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';

/**
 * Step 8: Sign & Submit
 *
 * Capture signature and submit the assessment for review.
 */
const Step8SignSubmit = ({ formData, assessment, onSubmit, saving }) => {
  const toast = useToast();
  const [signatureData, setSignatureData] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef(null);
  const lastPositionRef = useRef({ x: 0, y: 0 });

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    lastPositionRef.current = { x, y };
  };

  const draw = (e) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;

    ctx.beginPath();
    ctx.moveTo(lastPositionRef.current.x, lastPositionRef.current.y);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();

    lastPositionRef.current = { x, y };
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = canvasRef.current;
      if (canvas) {
        setSignatureData(canvas.toDataURL('image/png'));
      }
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setSignatureData(null);
    }
  };

  const handleSubmit = () => {
    if (!signatureData) {
      toast.error('Please provide a signature before submitting.');
      return;
    }
    onSubmit(signatureData);
  };

  const summaryItems = [
    {
      label: 'Farm',
      value: assessment?.farm_name || formData.farm_name || 'Selected',
    },
    {
      label: 'Assessment Year',
      value: formData.assessment_year,
    },
    {
      label: 'Water Sources Assessed',
      value: formData.selectedSources?.length || 0,
    },
    {
      label: 'Fields Assessed',
      value: formData.selectedFields?.length || 0,
    },
    {
      label: 'Overall Risk Score',
      value: assessment?.overall_risk_score
        ? `${Math.round(assessment.overall_risk_score)} / 100`
        : 'Not calculated',
    },
    {
      label: 'Risk Level',
      value: assessment?.risk_level?.toUpperCase() || 'Not calculated',
    },
    {
      label: 'FDA Determination',
      value: assessment?.fda_determination
        ?.replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase()) || 'Pending',
    },
    {
      label: 'Corrective Actions',
      value: formData.mitigationActions?.length || 0,
    },
  ];

  const canSubmit = signatureData && !saving;

  return (
    <div className="space-y-6">
      {/* Assessment Summary */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          Assessment Summary
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {summaryItems.map((item, index) => (
            <div key={index} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
              <p className="font-medium text-gray-900 dark:text-white mt-1">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Checklist */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Pre-Submission Checklist
        </h3>

        <div className="space-y-3">
          <ChecklistItem
            label="Water sources have been evaluated"
            checked={formData.sourceAssessments?.length > 0}
          />
          <ChecklistItem
            label="Field practices have been documented"
            checked={formData.fieldAssessments?.length > 0}
          />
          <ChecklistItem
            label="Environmental factors have been assessed"
            checked={!!formData.environmentalAssessment?.wildlife_pressure}
          />
          <ChecklistItem
            label="Risk scores have been calculated"
            checked={assessment?.overall_risk_score !== null && assessment?.overall_risk_score !== undefined}
          />
          <ChecklistItem
            label="Signature provided"
            checked={!!signatureData}
          />
        </div>
      </div>

      {/* Signature Capture */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <PenTool className="w-5 h-5 text-green-600" />
            Assessor Signature
          </h3>
          {signatureData && (
            <button
              onClick={clearSignature}
              className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <RefreshCw className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          By signing below, I certify that this water assessment has been conducted in
          accordance with 21 CFR Part 112 requirements and the information provided is
          accurate to the best of my knowledge.
        </p>

        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-2">
          <canvas
            ref={canvasRef}
            width={600}
            height={150}
            className="w-full bg-white rounded cursor-crosshair touch-none"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>

        {!signatureData && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
            Draw your signature above
          </p>
        )}
      </div>

      {/* Warning for incomplete assessment */}
      {(!assessment?.overall_risk_score) && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-900 dark:text-yellow-300">
                Risk Calculation Incomplete
              </h4>
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                Please go back to Step 7 and calculate risk scores before submitting.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg transition-colors ${
            canSubmit
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
          }`}
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Sign &amp; Complete Assessment
            </>
          )}
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">
          What Happens Next?
        </h4>
        <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
          <li>• <strong>Company owners, admins, and managers</strong> can complete and approve their own assessments</li>
          <li>• <strong>Other staff members</strong> will submit for supervisor approval before completion</li>
          <li>• A PDF report will be generated for your records and FDA audits</li>
          <li>• Any required corrective actions will be tracked until completion</li>
        </ul>
      </div>

      {/* FDA Requirements Box */}
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <h4 className="font-medium text-green-900 dark:text-green-300 mb-2">
          FDA Compliance Notes (21 CFR 112.43)
        </h4>
        <ul className="text-sm text-green-700 dark:text-green-400 space-y-1">
          <li>• <strong>Annual Requirement:</strong> Water assessments must be conducted at least once annually</li>
          <li>• <strong>Record Retention:</strong> Keep assessments for at least 2 years from harvest date</li>
          <li>• <strong>No FDA Submission Required:</strong> Assessments are kept on-site for audits, not submitted to FDA</li>
          <li>• <strong>Corrective Actions:</strong> If issues are found, corrective actions must be implemented and documented</li>
        </ul>
      </div>
    </div>
  );
};

/**
 * Checklist Item Component
 */
const ChecklistItem = ({ label, checked }) => (
  <div className="flex items-center gap-3">
    <div
      className={`w-6 h-6 rounded-full flex items-center justify-center ${
        checked
          ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
      }`}
    >
      {checked ? (
        <CheckCircle2 className="w-4 h-4" />
      ) : (
        <div className="w-2 h-2 rounded-full bg-current" />
      )}
    </div>
    <span
      className={`text-sm ${
        checked
          ? 'text-gray-900 dark:text-white'
          : 'text-gray-500 dark:text-gray-400'
      }`}
    >
      {label}
    </span>
  </div>
);

export default Step8SignSubmit;
