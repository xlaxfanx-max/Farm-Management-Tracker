import React, { useState, useEffect } from 'react';
import {
  Loader2,
  CheckCircle,
  Circle,
  ChevronRight,
  Sparkles,
  X,
  Rocket,
} from 'lucide-react';
import { primusGFSAPI } from '../../services/api';

/**
 * SetupWizard — Guided first-time setup for PrimusGFS.
 * Shows 6 setup steps with completion status and prefill indicators.
 * Displayed when fewer than 4 steps are complete.
 */
export default function SetupWizard({ onTabChange, onDismiss }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const res = await primusGFSAPI.getSetupStatus();
      setData(res.data);
    } catch (err) {
      console.error('Failed to load setup status:', err);
      setError('Failed to load setup status.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return null; // Silently fail — wizard is optional
  }

  if (!data) return null;

  const { steps, completed_count, total_steps } = data;
  const progressPct = Math.round((completed_count / total_steps) * 100);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-primary dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Getting Started
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Complete these steps to set up your PrimusGFS compliance program.
              </p>
            </div>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
            <span>{completed_count} of {total_steps} steps complete</span>
            <span>{progressPct}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {steps.map((step, index) => (
          <button
            key={step.key}
            onClick={() => onTabChange(step.tab)}
            className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
          >
            {/* Step indicator */}
            <div className="flex-shrink-0">
              {step.completed ? (
                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-primary dark:text-green-400" />
                </div>
              ) : step.partial ? (
                <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full border-2 border-yellow-500 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                  </div>
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <Circle className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                </div>
              )}
            </div>

            {/* Step content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-medium ${
                    step.completed
                      ? 'text-primary dark:text-green-400 line-through decoration-green-400/50'
                      : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {index + 1}. {step.label}
                </span>
                {step.prefill_available && !step.completed && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 rounded">
                    <Sparkles className="w-3 h-3" />
                    Prefill available
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {step.description}
              </p>
            </div>

            {/* Arrow */}
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
