import React from 'react';
import { CheckCircle2, Circle, X, ChevronRight } from 'lucide-react';

export default function SetupChecklist({ scoreData, onNavigate, onDismiss }) {
  if (!scoreData) return null;

  const { score_breakdown = [] } = scoreData;
  const failed = score_breakdown.filter((item) => !item.passed);

  if (failed.length === 0) return null;

  const total = score_breakdown.length;
  const completedCount = score_breakdown.filter((item) => item.passed).length;
  const firstThreeActions = failed.filter((item) => item.action && item.action_key).slice(0, 3);

  return (
    <div className="w-full bg-teal-50 dark:bg-teal-900/20 border border-teal-300 dark:border-teal-700 rounded-xl shadow-sm p-4 relative">
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 p-1 rounded text-teal-500 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-800 transition-colors"
        title="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="pr-6 mb-3">
        <h3 className="text-sm font-semibold text-teal-900 dark:text-teal-100">
          Complete Your Compliance Setup
        </h3>
        <p className="text-xs text-teal-700 dark:text-teal-300 mt-0.5">
          {completedCount} of {total} complete
        </p>
      </div>

      <div className="w-full bg-teal-200 dark:bg-teal-800 rounded-full h-1.5 mb-3">
        <div
          className="bg-teal-500 dark:bg-teal-400 h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${(completedCount / total) * 100}%` }}
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {score_breakdown.map((item) => (
          <div
            key={item.key}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors ${
              item.passed
                ? 'bg-primary-light dark:bg-green-900/20 border-green-200 dark:border-green-800 text-primary dark:text-green-300'
                : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'
            }`}
          >
            {item.passed ? (
              <CheckCircle2 className="w-3 h-3 text-green-500" />
            ) : (
              <Circle className="w-3 h-3" />
            )}
            {item.label}
          </div>
        ))}
      </div>

      {firstThreeActions.length > 0 && (
        <div className="space-y-1.5">
          {firstThreeActions.map((item) => (
            <button
              key={item.key}
              onClick={() => onNavigate(item.action_key)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-teal-200 dark:border-teal-700 rounded-lg text-sm text-teal-800 dark:text-teal-200 hover:bg-teal-50 dark:hover:bg-teal-900/40 transition-colors text-left"
            >
              <ChevronRight className="w-4 h-4 text-teal-500 dark:text-teal-400 flex-shrink-0" />
              {item.action}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
