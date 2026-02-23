import React, { useState, useEffect } from 'react';
import {
  Shield, ChevronRight, ChevronLeft, Check, FileText, Users,
  Droplets, ClipboardCheck, AlertTriangle, Loader2
} from 'lucide-react';
import { complianceProfileAPI, complianceDeadlinesAPI } from '../../services/api';

const STEPS = [
  {
    id: 'regulations',
    title: 'Your Regulations',
    description: 'Select which compliance frameworks apply to your operation',
    icon: Shield,
  },
  {
    id: 'licenses',
    title: 'Licenses & Certs',
    description: 'Enter your active licenses and certifications',
    icon: FileText,
  },
  {
    id: 'training',
    title: 'WPS Training',
    description: 'Add worker safety training records',
    icon: Users,
  },
  {
    id: 'water',
    title: 'Water Sources',
    description: 'Set up water source testing schedules',
    icon: Droplets,
  },
  {
    id: 'deadlines',
    title: 'Generate Deadlines',
    description: 'Auto-generate your compliance calendar',
    icon: ClipboardCheck,
  },
];

const REGULATIONS = [
  { key: 'pur_reporting', label: 'PUR Reporting', description: 'California Pesticide Use Reporting' },
  { key: 'wps_compliance', label: 'Worker Protection Standard', description: 'EPA Worker Protection Standard' },
  { key: 'fsma_compliance', label: 'FSMA Produce Safety', description: 'FDA Food Safety Modernization Act' },
  { key: 'sgma_compliance', label: 'SGMA', description: 'Sustainable Groundwater Management Act' },
  { key: 'ilrp_compliance', label: 'ILRP', description: 'Irrigated Lands Regulatory Program' },
  { key: 'organic_certification', label: 'Organic', description: 'USDA Organic Certification' },
  { key: 'globalgap_certification', label: 'GlobalGAP', description: 'GlobalGAP Certification' },
  { key: 'primusgfs_certification', label: 'PrimusGFS', description: 'PrimusGFS GAP/GMP Certification' },
];

export default function ComplianceOnboarding({ onComplete, onSkip }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [profile, setProfile] = useState({});
  const [selectedRegulations, setSelectedRegulations] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingDeadlines, setGeneratingDeadlines] = useState(false);
  const [deadlinesGenerated, setDeadlinesGenerated] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await complianceProfileAPI.get();
      const data = response.data;
      if (Array.isArray(data) && data.length > 0) {
        setProfile(data[0]);
        const regs = {};
        REGULATIONS.forEach(r => {
          regs[r.key] = data[0][r.key] || false;
        });
        setSelectedRegulations(regs);
      }
    } catch (error) {
      console.error('Error loading compliance profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRegulation = (key) => {
    setSelectedRegulations(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const saveRegulations = async () => {
    setSaving(true);
    try {
      await complianceProfileAPI.update(selectedRegulations);
    } catch (error) {
      console.error('Error saving regulations:', error);
    } finally {
      setSaving(false);
    }
  };

  const generateDeadlines = async () => {
    setGeneratingDeadlines(true);
    try {
      await complianceDeadlinesAPI.generateDeadlines();
      setDeadlinesGenerated(true);
    } catch (error) {
      console.error('Error generating deadlines:', error);
    } finally {
      setGeneratingDeadlines(false);
    }
  };

  const handleNext = async () => {
    if (currentStep === 0) {
      await saveRegulations();
    }
    if (currentStep === STEPS.length - 1) {
      onComplete?.();
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const step = STEPS[currentStep];
  const enabledCount = Object.values(selectedRegulations).filter(Boolean).length;

  return (
    <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Compliance Setup</h2>
            <p className="text-blue-100 mt-1">
              Step {currentStep + 1} of {STEPS.length}: {step.title}
            </p>
          </div>
          <button
            onClick={onSkip}
            className="text-blue-200 hover:text-white text-sm underline"
          >
            Skip for now
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex gap-2 mt-4">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`flex-1 h-2 rounded-full transition-colors ${
                i <= currentStep ? 'bg-white' : 'bg-blue-400/30'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="p-6">
        {/* Step 1: Regulations */}
        {currentStep === 0 && (
          <div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{step.description}</p>
            <div className="grid gap-3">
              {REGULATIONS.map(reg => (
                <label
                  key={reg.key}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedRegulations[reg.key]
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedRegulations[reg.key] || false}
                    onChange={() => toggleRegulation(reg.key)}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded flex items-center justify-center border-2 ${
                    selectedRegulations[reg.key]
                      ? 'bg-blue-500 border-blue-500'
                      : 'border-gray-300'
                  }`}>
                    {selectedRegulations[reg.key] && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white">{reg.label}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{reg.description}</div>
                  </div>
                </label>
              ))}
            </div>
            {enabledCount > 0 && (
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-3">
                {enabledCount} regulation{enabledCount !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>
        )}

        {/* Step 2: Licenses */}
        {currentStep === 1 && (
          <div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{step.description}</p>
            <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Add your QAL, QAC, PCA, and other licenses in the{' '}
                  <strong>Licenses & Certifications</strong> section. The system will
                  track expirations and send reminders.
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-2">
                  You can add licenses now or come back later from the Compliance Hub.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: WPS Training */}
        {currentStep === 2 && (
          <div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{step.description}</p>
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Add WPS training records for your workers in the{' '}
                <strong>WPS Compliance</strong> section. The system tracks:
              </p>
              <ul className="text-sm text-blue-700 dark:text-blue-400 mt-2 space-y-1 ml-4 list-disc">
                <li>Pesticide safety training (annual)</li>
                <li>Handler training (annual)</li>
                <li>Respirator fit tests (annual)</li>
                <li>Heat illness prevention</li>
                <li>First aid/CPR (every 2 years)</li>
              </ul>
            </div>
          </div>
        )}

        {/* Step 4: Water Sources */}
        {currentStep === 3 && (
          <div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{step.description}</p>
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Your water sources should already be set up in the Water Management section.
                The compliance system will:
              </p>
              <ul className="text-sm text-blue-700 dark:text-blue-400 mt-2 space-y-1 ml-4 list-disc">
                <li>Track FSMA water testing schedules</li>
                <li>Calculate E. coli Geometric Mean (GM) and STV</li>
                <li>Alert when tests are overdue</li>
                <li>Monitor SGMA extraction compliance</li>
              </ul>
            </div>
          </div>
        )}

        {/* Step 5: Generate Deadlines */}
        {currentStep === 4 && (
          <div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{step.description}</p>

            {deadlinesGenerated ? (
              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4 flex gap-3">
                <Check className="w-5 h-5 text-green-500 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-300">Deadlines generated!</p>
                  <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                    Your compliance calendar has been populated with 12 months of
                    regulatory deadlines based on your selected regulations.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <ClipboardCheck className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Auto-generate 12 months of compliance deadlines based on
                  your selected regulations (PUR monthly, SGMA semi-annual,
                  WPS annual, water testing quarterly).
                </p>
                <button
                  onClick={generateDeadlines}
                  disabled={generatingDeadlines}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700
                    disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
                >
                  {generatingDeadlines ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <ClipboardCheck className="w-4 h-4" />
                      Generate Deadlines
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer navigation */}
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t dark:border-gray-700 flex items-center justify-between">
        <button
          onClick={handleBack}
          disabled={currentStep === 0}
          className="flex items-center gap-1 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white
            disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div
                key={s.id}
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  i < currentStep
                    ? 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400'
                    : i === currentStep
                    ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                }`}
              >
                {i < currentStep ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={handleNext}
          disabled={saving}
          className="flex items-center gap-1 px-6 py-2 bg-blue-600 text-white rounded-lg
            hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : currentStep === STEPS.length - 1 ? (
            'Finish Setup'
          ) : (
            <>
              Next
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
