import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Zap,
  ArrowRight,
  Clock,
  Database,
  Loader2,
  RefreshCw,
  ChevronRight,
  Sparkles,
  BarChart3,
} from 'lucide-react';
import { primusGFSAPI } from '../../services/api';

/**
 * Progress Pipeline — visual funnel showing not-started / in-progress / compliant.
 */
const ProgressPipeline = ({ pipeline }) => {
  const total = pipeline?.total || 27;
  const segments = [
    {
      label: 'Not Started',
      count: pipeline?.not_started || 0,
      color: 'bg-red-500',
      textColor: 'text-red-700 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
    },
    {
      label: 'In Progress',
      count: pipeline?.in_progress || 0,
      color: 'bg-yellow-500',
      textColor: 'text-yellow-700 dark:text-yellow-400',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    },
    {
      label: 'Compliant',
      count: pipeline?.compliant || 0,
      color: 'bg-green-500',
      textColor: 'text-primary dark:text-green-400',
      bgColor: 'bg-primary-light dark:bg-green-900/20',
    },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-primary" />
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          Progress Pipeline
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
          {total} modules total
        </span>
      </div>

      {/* Stacked bar */}
      <div className="flex h-4 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 mb-4">
        {segments.map((seg) =>
          seg.count > 0 ? (
            <div
              key={seg.label}
              className={`${seg.color} transition-all duration-500`}
              style={{ width: `${(seg.count / total) * 100}%` }}
              title={`${seg.label}: ${seg.count}`}
            />
          ) : null
        )}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-3 gap-3">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={`${seg.bgColor} rounded-lg p-3 text-center`}
          >
            <div className={`text-2xl font-bold ${seg.textColor}`}>
              {seg.count}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {seg.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Needs Attention Card
 */
const AttentionCard = ({ item, onNavigate }) => {
  const urgencyStyles = {
    3: {
      border: 'border-red-200 dark:border-red-800',
      bg: 'bg-red-50 dark:bg-red-900/10',
      badge: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
      badgeText: 'Urgent',
    },
    2: {
      border: 'border-orange-200 dark:border-orange-800',
      bg: 'bg-orange-50 dark:bg-orange-900/10',
      badge: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
      badgeText: 'High',
    },
    1: {
      border: 'border-yellow-200 dark:border-yellow-800',
      bg: 'bg-yellow-50 dark:bg-yellow-900/10',
      badge: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
      badgeText: 'Medium',
    },
  };

  const style = urgencyStyles[item.urgency] || urgencyStyles[1];

  return (
    <div
      className={`${style.bg} border ${style.border} rounded-lg p-4 hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            {item.label}
          </h4>
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${style.badge}`}>
            {style.badgeText}
          </span>
        </div>
        <span className={`text-lg font-bold ${
          item.score === 0 ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'
        }`}>
          {item.score}%
        </span>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        {item.action}
      </p>

      <div className="flex items-center justify-between">
        {item.effort && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Clock className="w-3 h-3" />
            {item.effort}
          </span>
        )}
        <button
          onClick={() => onNavigate(item.tab)}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 ml-auto"
        >
          Go Fix
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

/**
 * Quick Win Card
 */
const QuickWinCard = ({ item, onNavigate }) => (
  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between mb-2">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
        {item.label}
      </h4>
      <span className="text-lg font-bold text-primary dark:text-green-400">
        {item.score}%
      </span>
    </div>

    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
      {item.action}
    </p>

    {/* Progress to 100% */}
    <div className="mb-3">
      <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all"
          style={{ width: `${item.score}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-gray-400">{100 - item.score}% to go</span>
        {item.effort && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Clock className="w-3 h-3" />
            {item.effort}
          </span>
        )}
      </div>
    </div>

    <button
      onClick={() => onNavigate(item.tab)}
      className="inline-flex items-center gap-1 text-sm font-medium text-primary dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
    >
      Finish Up
      <ArrowRight className="w-3.5 h-3.5" />
    </button>
  </div>
);

/**
 * Auto-Populated Data Card
 */
const DataAvailableCard = ({ item, onNavigate }) => (
  <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
    <Database className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-sm text-gray-900 dark:text-white">
        {item.message}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
        Source: {item.source}
      </p>
    </div>
    <button
      onClick={() => onNavigate(item.tab)}
      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 flex-shrink-0"
    >
      Review
      <ChevronRight className="w-3 h-3" />
    </button>
  </div>
);

/**
 * WhatsNextDashboard — Smart action-oriented landing page.
 *
 * Shows: Needs Attention | Quick Wins | Progress Pipeline
 * Bottom: Data Available from Platform
 */
const WhatsNextDashboard = ({ onTabChange }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await primusGFSAPI.getWhatsNext();
      setData(response.data);
    } catch (err) {
      console.error('Error loading What\'s Next:', err);
      setError('Failed to load action items. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
          <p className="text-red-700 dark:text-red-300 flex-1">{error}</p>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const {
    overall_score,
    needs_attention = [],
    quick_wins = [],
    auto_populated = [],
    progress_pipeline,
    upcoming_deadlines = [],
  } = data;

  // Determine a helpful overall message
  const getOverallMessage = () => {
    if (overall_score >= 80) return 'Great job! Most modules are compliant.';
    if (overall_score >= 60) return 'Good progress — focus on the items below to boost your score.';
    if (overall_score >= 30) return 'Getting started — tackle the urgent items first.';
    return 'Let\'s get started! Begin with the Getting Started section.';
  };

  return (
    <div className="space-y-6">
      {/* Header with overall score */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`text-4xl font-bold ${
              overall_score >= 80
                ? 'text-primary dark:text-green-400'
                : overall_score >= 60
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {overall_score}%
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                What's Next
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {getOverallMessage()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onTabChange('full-overview')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Full Overview
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main three-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Needs Attention */}
        <div className="lg:col-span-2 space-y-4">
          {needs_attention.length > 0 ? (
            <>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  Needs Attention
                </h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ({needs_attention.length} items)
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {needs_attention.map((item) => (
                  <AttentionCard
                    key={item.module}
                    item={item}
                    onNavigate={onTabChange}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="bg-primary-light dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-6 text-center">
              <CheckCircle2 className="w-10 h-10 text-primary dark:text-green-400 mx-auto mb-2" />
              <h3 className="text-base font-semibold text-green-800 dark:text-green-300">
                All Clear!
              </h3>
              <p className="text-sm text-primary dark:text-green-400 mt-1">
                No modules need urgent attention.
              </p>
            </div>
          )}

          {/* Quick Wins */}
          {quick_wins.length > 0 && (
            <>
              <div className="flex items-center gap-2 mt-6">
                <Zap className="w-5 h-5 text-primary dark:text-green-400" />
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  Quick Wins
                </h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  — almost there!
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {quick_wins.map((item) => (
                  <QuickWinCard
                    key={item.module}
                    item={item}
                    onNavigate={onTabChange}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* RIGHT: Progress Pipeline + Deadlines */}
        <div className="space-y-4">
          <ProgressPipeline pipeline={progress_pipeline} />

          {/* Upcoming Deadlines */}
          {upcoming_deadlines.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  Upcoming Deadlines
                </h3>
              </div>
              <div className="space-y-2">
                {upcoming_deadlines.map((dl, idx) => {
                  const dueDate = new Date(dl.due_date);
                  const now = new Date();
                  now.setHours(0, 0, 0, 0);
                  const daysUntil = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

                  return (
                    <div
                      key={dl.id || idx}
                      className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {dl.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {dueDate.toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                        daysUntil <= 7
                          ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                          : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                      }`}>
                        {daysUntil <= 0 ? 'Today' : `${daysUntil}d`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Compliant modules count */}
          {progress_pipeline?.compliant > 0 && (
            <div className="bg-primary-light dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
              <Sparkles className="w-6 h-6 text-primary dark:text-green-400 mx-auto mb-1" />
              <div className="text-2xl font-bold text-primary dark:text-green-400">
                {progress_pipeline.compliant}
              </div>
              <div className="text-xs text-primary dark:text-green-400">
                modules at 80%+ compliance
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Data Available from Platform */}
      {auto_populated.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Data Available from Platform
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              — import to save time
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {auto_populated.map((item, idx) => (
              <DataAvailableCard
                key={`${item.module}-${idx}`}
                item={item}
                onNavigate={onTabChange}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsNextDashboard;
