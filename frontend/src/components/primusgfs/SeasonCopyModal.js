import React, { useState } from 'react';
import {
  Copy,
  X,
  Loader2,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { primusGFSAPI } from '../../services/api';

const COPYABLE_MODULES = [
  {
    key: 'food_defense',
    label: 'Food Defense Plan',
    description: 'Vulnerability assessments, security measures, and emergency procedures.',
  },
  {
    key: 'food_fraud',
    label: 'Food Fraud Assessment',
    description: 'Fraud vulnerability assessment and mitigation strategies.',
  },
  {
    key: 'pest_control',
    label: 'Pest Control Program',
    description: 'PCO information, monitoring stations, target pests, and products.',
  },
  {
    key: 'pre_season',
    label: 'Pre-Season Checklists',
    description: 'Per-farm pre-season checklists (approval/deficiency flags reset).',
  },
  {
    key: 'field_risk',
    label: 'Field Risk Assessments',
    description: 'Per-farm risk assessments (approval flags reset).',
  },
];

const inputCls =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm';

export default function SeasonCopyModal({ onClose, onCopied }) {
  const currentYear = new Date().getFullYear();

  const [sourceYear, setSourceYear] = useState(currentYear - 1);
  const [targetYear, setTargetYear] = useState(currentYear);
  const [selectedModules, setSelectedModules] = useState(
    COPYABLE_MODULES.map((m) => m.key)
  );
  const [step, setStep] = useState('select'); // 'select' | 'confirm' | 'done'
  const [copying, setCopying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const toggleModule = (key) => {
    setSelectedModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleAll = () => {
    if (selectedModules.length === COPYABLE_MODULES.length) {
      setSelectedModules([]);
    } else {
      setSelectedModules(COPYABLE_MODULES.map((m) => m.key));
    }
  };

  const handleCopy = async () => {
    setCopying(true);
    setError(null);
    try {
      const res = await primusGFSAPI.copyForward({
        source_year: sourceYear,
        target_year: targetYear,
        modules: selectedModules,
      });
      setResult(res.data);
      setStep('done');
    } catch (err) {
      console.error('Copy forward failed:', err);
      setError(
        err.response?.data?.error ||
        err.response?.data?.detail ||
        'Copy failed. Please try again.'
      );
    } finally {
      setCopying(false);
    }
  };

  const yearOptions = [];
  for (let y = currentYear + 1; y >= currentYear - 4; y--) {
    yearOptions.push(y);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Copy from Previous Season
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {step === 'select' && (
            <>
              {/* Year selectors */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Copy From
                  </label>
                  <select
                    value={sourceYear}
                    onChange={(e) => setSourceYear(Number(e.target.value))}
                    className={inputCls}
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Copy To
                  </label>
                  <select
                    value={targetYear}
                    onChange={(e) => setTargetYear(Number(e.target.value))}
                    className={inputCls}
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              {sourceYear === targetYear && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-700 dark:text-yellow-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  Source and target years must be different.
                </div>
              )}

              {/* Module checklist */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Modules to Copy
                  </h3>
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs text-green-600 dark:text-green-400 hover:underline"
                  >
                    {selectedModules.length === COPYABLE_MODULES.length
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>
                </div>
                <div className="space-y-2">
                  {COPYABLE_MODULES.map((mod) => (
                    <label
                      key={mod.key}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedModules.includes(mod.key)
                          ? 'border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedModules.includes(mod.key)}
                        onChange={() => toggleModule(mod.key)}
                        className="w-4 h-4 mt-0.5 rounded border-gray-300 text-green-600 focus:ring-green-500 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {mod.label}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {mod.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 'confirm' && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">
                  Confirm Copy
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  This will copy {selectedModules.length} module(s) from{' '}
                  <strong>{sourceYear}</strong> to <strong>{targetYear}</strong>.
                  Existing records in the target year will not be overwritten.
                  Approval flags will be reset on copied records.
                </p>
              </div>

              <div className="space-y-1">
                {COPYABLE_MODULES.filter((m) =>
                  selectedModules.includes(m.key)
                ).map((mod) => (
                  <div
                    key={mod.key}
                    className="flex items-center gap-2 p-2 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <ChevronRight className="w-4 h-4 text-green-500" />
                    {mod.label}
                  </div>
                ))}
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
            </div>
          )}

          {step === 'done' && result && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-center">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  Copied {result.total_copied} record(s) from {result.source_year} to{' '}
                  {result.target_year}
                </p>
              </div>

              <div className="space-y-1">
                {Object.entries(result.results || {}).map(([key, count]) => {
                  const mod = COPYABLE_MODULES.find((m) => m.key === key);
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between p-2 text-sm"
                    >
                      <span className="text-gray-700 dark:text-gray-300">
                        {mod?.label || key}
                      </span>
                      <span
                        className={`font-medium ${
                          count > 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-400 dark:text-gray-500'
                        }`}
                      >
                        {count > 0 ? `${count} copied` : 'skipped'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800 rounded-b-xl">
          {step === 'select' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setStep('confirm')}
                disabled={
                  selectedModules.length === 0 || sourceYear === targetYear
                }
                className="inline-flex items-center gap-2 px-5 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
              >
                Review <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}

          {step === 'confirm' && (
            <>
              <button
                type="button"
                onClick={() => setStep('select')}
                disabled={copying}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleCopy}
                disabled={copying}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
              >
                {copying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Copying...
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> Copy Now
                  </>
                )}
              </button>
            </>
          )}

          {step === 'done' && (
            <button
              type="button"
              onClick={() => {
                if (onCopied) onCopied();
                onClose();
              }}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              <CheckCircle className="w-4 h-4" /> Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
