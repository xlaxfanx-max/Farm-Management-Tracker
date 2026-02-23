import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import api from '../../services/api';

function ScoreRing({ score }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(score, 0), 100);
  const dashOffset = circumference - (progress / 100) * circumference;

  let ringColor;
  if (score >= 75) ringColor = '#22c55e';
  else if (score >= 50) ringColor = '#f59e0b';
  else ringColor = '#ef4444';

  let textColor;
  if (score >= 75) textColor = 'text-green-600 dark:text-green-400';
  else if (score >= 50) textColor = 'text-amber-600 dark:text-amber-400';
  else textColor = 'text-red-600 dark:text-red-400';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-gray-200 dark:text-gray-700"
          />
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold leading-none ${textColor}`}>{score}</span>
        </div>
      </div>
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Setup Score</span>
    </div>
  );
}

function BreakdownRow({ item, onNavigate }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div className="flex-shrink-0 mt-0.5">
        {item.passed ? (
          <CheckCircle2 className="w-4 h-4 text-green-500 dark:text-green-400" />
        ) : (
          <XCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 dark:text-gray-200">{item.label}</p>
        {!item.passed && item.action && (
          <button
            onClick={() => item.action_key && onNavigate(item.action_key)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-0.5"
          >
            {item.action}
          </button>
        )}
      </div>
      <div className="flex-shrink-0 text-xs font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap">
        {item.earned}/{item.possible} pts
      </div>
    </div>
  );
}

function GapPill({ item, onNavigate }) {
  return (
    <button
      onClick={() => item.action_key && onNavigate(item.action_key)}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-full text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
    >
      <span className="font-bold text-green-600 dark:text-green-400">+{item.points} pts</span>
      {item.action}
    </button>
  );
}

export default function ComplianceScoreBreakdown({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/compliance/dashboard/smart-score/');
      setData(res.data);
    } catch {
      setError('Could not load compliance score.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-3 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 p-4 shadow-sm">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { score, score_breakdown = [], gap_items = [] } = data;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm space-y-4">
      <div className="flex items-center gap-5">
        <ScoreRing score={score} />
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Compliance Score
          </h2>
          {gap_items.length > 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              {gap_items.length} area{gap_items.length !== 1 ? 's' : ''} to improve
            </p>
          ) : (
            <p className="text-xs text-green-600 dark:text-green-400 mb-2">
              All areas complete
            </p>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            {expanded ? 'Hide breakdown' : 'Show breakdown'}
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
        <button
          onClick={fetchData}
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
          title="Refresh score"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
          {score_breakdown.map((item) => (
            <BreakdownRow key={item.key} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      )}

      {gap_items.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
            Quick Wins
          </p>
          <div className="flex flex-wrap gap-2">
            {gap_items.map((item) => (
              <GapPill key={item.key} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
