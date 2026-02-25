// =============================================================================
// PUR IMPORT WIZARD - MAIN PAGE
// 3-step wizard: Upload PDF -> Review parsed reports -> Confirm import
// + Import History tab to browse past batches
// =============================================================================

import React, { useState, useCallback } from 'react';
import {
  Upload,
  ClipboardCheck,
  CheckCircle2,
  ArrowLeft,
  FileText,
  History,
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import PURUploadStep from './PURUploadStep';
import PURReviewStep from './PURReviewStep';
import PURConfirmStep from './PURConfirmStep';
import PURImportHistory from './PURImportHistory';

const STEPS = [
  { key: 'upload', label: 'Upload', icon: Upload },
  { key: 'review', label: 'Review', icon: ClipboardCheck },
  { key: 'confirm', label: 'Confirm', icon: CheckCircle2 },
];

const PURImportPage = () => {
  const { farms, refreshApplicationEvents, refreshUnifiedProducts, refreshApplicators } = useData();

  // Tab: 'import' or 'history'
  const [activeTab, setActiveTab] = useState('import');

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);

  // Data flowing through wizard steps
  const [uploadResponse, setUploadResponse] = useState(null);
  const [reviewData, setReviewData] = useState(null);
  const [importResults, setImportResults] = useState(null);

  // PDF file blob + batch ID for preview and linking
  const [pdfFile, setPdfFile] = useState(null);
  const [batchId, setBatchId] = useState(null);

  // Step 1 -> Step 2: upload succeeded, move to review
  const handleUploadComplete = useCallback((response, file) => {
    setUploadResponse(response);
    setPdfFile(file || null);
    setBatchId(response.batch_id || null);
    // Initialize review selections: all reports selected by default
    const initial = response.reports.map((report, idx) => ({
      ...report,
      _index: idx,
      _selected: true,
      _farmId: report._match_info?.farm_matches?.[0]?.farm_id || null,
      _rememberMapping: false,
      _editedComments: report.comments || '',
    }));
    setReviewData(initial);
    setCurrentStep(1);
  }, []);

  // Step 2 -> Step 3: review finished, move to confirm
  const handleReviewComplete = useCallback((finalizedReports) => {
    setReviewData(finalizedReports);
    setCurrentStep(2);
  }, []);

  // Step 3 complete: import finished — refresh DataContext
  const handleImportComplete = useCallback((results) => {
    setImportResults(results);
    // Refresh context so Dashboard, PUR Reports, etc. see the new data
    refreshApplicationEvents();
    refreshUnifiedProducts();
    refreshApplicators();
  }, [refreshApplicationEvents, refreshUnifiedProducts, refreshApplicators]);

  // Navigation
  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  // Reset wizard to start over
  const handleReset = useCallback(() => {
    setCurrentStep(0);
    setUploadResponse(null);
    setReviewData(null);
    setImportResults(null);
    setPdfFile(null);
    setBatchId(null);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="w-7 h-7 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">
            Import PUR Reports
          </h1>
        </div>
        <p className="text-gray-500 text-sm">
          Upload a Pesticide Use Report PDF to extract and import application
          events into your records.
        </p>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('import')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'import'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Upload className="w-4 h-4" />
          Import New
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'history'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <History className="w-4 h-4" />
          Import History
        </button>
      </div>

      {activeTab === 'history' ? (
        <PURImportHistory />
      ) : (
        <>
          {/* Step indicator */}
          <div className="mb-8">
            <nav aria-label="Progress">
              <ol className="flex items-center">
                {STEPS.map((step, idx) => {
                  const StepIcon = step.icon;
                  const isComplete = idx < currentStep;
                  const isCurrent = idx === currentStep;

                  return (
                    <li
                      key={step.key}
                      className={`relative flex-1 ${
                        idx < STEPS.length - 1 ? 'pr-8 sm:pr-12' : ''
                      }`}
                    >
                      <div className="flex items-center">
                        <div
                          className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                            isComplete
                              ? 'bg-primary border-primary text-white'
                              : isCurrent
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'bg-white border-gray-300 text-gray-400'
                          }`}
                        >
                          {isComplete ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : (
                            <StepIcon className="w-5 h-5" />
                          )}
                        </div>
                        <span
                          className={`ml-3 text-sm font-medium ${
                            isCurrent
                              ? 'text-blue-600'
                              : isComplete
                                ? 'text-primary'
                                : 'text-gray-400'
                          }`}
                        >
                          {step.label}
                        </span>
                        {idx < STEPS.length - 1 && (
                          <div
                            className={`hidden sm:block absolute top-5 left-full w-full h-0.5 -translate-y-1/2 ${
                              isComplete ? 'bg-primary' : 'bg-gray-200'
                            }`}
                            style={{ width: 'calc(100% - 5rem)' }}
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </nav>
          </div>

          {/* Back button (steps 2 and 3, but not after import completes) */}
          {currentStep > 0 && !importResults && (
            <button
              onClick={handleBack}
              className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to {STEPS[currentStep - 1].label}
            </button>
          )}

          {/* Step content */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            {currentStep === 0 && (
              <PURUploadStep onComplete={handleUploadComplete} />
            )}

            {currentStep === 1 && reviewData && (
              <PURReviewStep
                reports={reviewData}
                farms={farms}
                filename={uploadResponse?.filename}
                pdfFile={pdfFile}
                onReportsChange={setReviewData}
                onComplete={handleReviewComplete}
              />
            )}

            {currentStep === 2 && reviewData && (
              <PURConfirmStep
                reports={reviewData}
                farms={farms}
                filename={uploadResponse?.filename}
                batchId={batchId}
                onComplete={handleImportComplete}
                onReset={handleReset}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default PURImportPage;
