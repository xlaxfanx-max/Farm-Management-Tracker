import React, { useState, useEffect, useCallback } from 'react';
import { Lightbulb, ChevronDown, ChevronUp, X } from 'lucide-react';
import api from '../../services/api';

const PRIORITY_STYLES = {
  high: {
    card: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    dot: 'bg-red-500',
    label: 'text-red-700 dark:text-red-300',
    button: 'text-red-700 dark:text-red-300 hover:underline',
  },
  medium: {
    card: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
    label: 'text-amber-800 dark:text-amber-200',
    button: 'text-amber-700 dark:text-amber-300 hover:underline',
  },
  low: {
    card: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-400',
    label: 'text-blue-800 dark:text-blue-200',
    button: 'text-blue-600 dark:text-blue-400 hover:underline',
  },
};

export default function SuggestionsPanel({ onNavigate }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(new Set());

  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await api.get('/compliance/dashboard/suggestions/');
      const list = Array.isArray(res.data) ? res.data : res.data.results || [];
      setSuggestions(list);
    } catch {
      // silently fail — suggestions are supplementary
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const visible = suggestions.filter((s) => !dismissed.has(s.key));

  if (loading || visible.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Smart Suggestions
          </span>
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-bold">
            {visible.length}
          </span>
        </div>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-2">
          {visible.map((s) => {
            const styles = PRIORITY_STYLES[s.priority] || PRIORITY_STYLES.low;
            return (
              <div
                key={s.key}
                className={`flex items-start gap-3 p-3 rounded-lg border ${styles.card}`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${styles.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${styles.label}`}>{s.message}</p>
                  {s.action && s.action_key && (
                    <button
                      onClick={() => onNavigate(s.action_key)}
                      className={`text-xs mt-0.5 font-medium ${styles.button}`}
                    >
                      {s.action} →
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setDismissed((prev) => new Set([...prev, s.key]))}
                  className="flex-shrink-0 p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
